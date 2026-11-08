import Service, { service } from '@ember/service';
import { getOwner } from '@ember/application';
import C from 'ui/utils/constants';
import { CommandError, safeText } from 'ui/utils/ai-command-contract';

const privateSessionPins = new WeakMap();

function identity(project) {
  const read = (key) => project && project.get(key);
  if (!project || read('removed') || read('kind') !== 'project' || typeof read('id') !== 'string' ||
    typeof read('uuid') !== 'string' || !read('uuid') || typeof read('name') !== 'string') { throw new CommandError('CONFLICT'); }
  return {id: read('id'), uuid: read('uuid'), name: read('name'), state: read('state'),
    description: typeof read('description') === 'string' ? read('description') : null};
}

export default Service.extend({
  cookies: service(),
  authSession: service('auth-session'),
  commandContext: service('ai-command-context'),
  projects: service(),
  prefs: service(),
  intl: service(),

  assertSession(captured, originalToken) {
    const auth = this.get('authSession'), shared = auth.readShared();
    if (auth.capture() !== captured.generation || auth.get('accountId') !== captured.accountId || !shared ||
      shared.generation !== captured.generation || shared.accountId !== captured.accountId || !auth.get('tokenSnapshot') ||
      this.get('cookies').get(C.COOKIE.TOKEN) !== auth.get('tokenSnapshot') || typeof originalToken !== 'string' ||
      !originalToken || auth.get('tokenSnapshot') !== originalToken) { throw new CommandError('CONTEXT_CHANGED'); }
  },

  async selected(id, operation) {
    const project = identity(await this.get('projects')._activeProjectFromId(id));
    if (project.id !== id || operation === 'set_default' && project.state !== 'active') { throw new CommandError('CONFLICT'); }
    return project;
  },

  async preview(selection, captured) {
    const originalToken = this.get('authSession.tokenSnapshot');
    const actorOptions = () => ({credentials: 'omit', headers: {Authorization: 'Bearer ' + originalToken}});
    const check = () => { this.get('commandContext').context.assertCurrent(captured); this.assertSession(captured, originalToken); };
    check();
    const target = await this.selected(selection.id, selection.operation); check();
    const source = identity(this.get('projects.current'));
    if (source.id !== captured.projectId) { throw new CommandError('CONTEXT_CHANGED'); }
    let preference = null, before = captured.projectName;
    if (selection.operation === 'set_default') {
      preference = await this.get('prefs').readDefaultProject(captured.accountId, actorOptions); check();
      before = this.get('intl').t('generic.none');
      if (preference.projectId) {
        try { before = (await this.selected(preference.projectId, 'switch_context')).name; }
        catch (error) {
          if (![403, 404].includes(Number(error && (error.status || error.statusCode)))) { throw error; }
          before = this.get('intl').t('generic.unknown');
        }
        check();
      }
    }
    const binding = {operation: selection.operation, target, source, preference: preference && {id: preference.id, projectId: preference.projectId},
      before: safeText(before, 1024), after: safeText(target.name, 1024), description: safeText(target.description, 1024)};
    privateSessionPins.set(binding, originalToken);
    return binding;
  },

  async confirm(binding, captured, currentReview) {
    const originalToken = privateSessionPins.get(binding);
    const actorOptions = () => ({credentials: 'omit', headers: {Authorization: 'Bearer ' + originalToken}});
    const check = () => {
      if (!currentReview()) { throw new CommandError('CONFLICT'); }
      this.get('commandContext').context.assertCurrent(captured); this.assertSession(captured, originalToken);
      if (JSON.stringify(identity(this.get('projects.current'))) !== JSON.stringify(binding.source)) { throw new CommandError('CONTEXT_CHANGED'); }
    };
    let submitted = false;
    try {
      check();
      const target = await this.selected(binding.target.id, binding.operation); check();
      if (JSON.stringify(target) !== JSON.stringify(binding.target)) { throw new CommandError('CONFLICT'); }
      const commit = (action) => this.get('authSession').runPassiveSynchronous(() => { check(); submitted = true; action(); });
      if (binding.operation === 'set_default') {
        await this.get('prefs').saveDefaultProject(target.id, captured.accountId, binding.preference, check, commit, actorOptions);
        check();
        const settled = await this.selected(target.id, binding.operation); check();
        if (JSON.stringify(settled) !== JSON.stringify(target)) { throw new CommandError('CONFLICT'); }
        return {effectScope: 'account-preference', readbackComplete: true};
      }
      if (binding.operation !== 'switch_context') { throw new CommandError('INVALID_INPUT'); }
      const route = getOwner(this).lookup('route:authenticated');
      await route.switchProjectExact(target, check, commit, () => this.assertSession(captured, originalToken));
      this.assertSession(captured, originalToken);
      return {effectScope: 'browser-context', readbackComplete: true, referencesInvalidated: true};
    } catch (error) {
      if (submitted && error instanceof CommandError && ['CONTEXT_CHANGED', 'CONFLICT'].includes(error.code)) {
        throw new CommandError('UNKNOWN_RESULT');
      }
      throw error;
    } finally { privateSessionPins.delete(binding); }
  },
});

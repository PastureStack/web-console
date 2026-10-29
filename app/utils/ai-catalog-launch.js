import { CommandError, safeText } from './ai-command-contract';

export const CATALOG_LAUNCH_COLLECTION = 'aiCatalogStackLaunchPlans';
export const CATALOG_OPTIONS_COLLECTION = 'aiCatalogStackLaunchOptions';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OPTIONS_ID = new RegExp(`^acopts-${UUID}$`, 'i');
const TEMPLATE_ID = /^ctm-[0-9a-f]{64}$/;
const VERSION_ID = /^cvm-[0-9a-f]{64}$/;
const TYPES = ['string', 'int', 'float', 'boolean', 'enum', 'reference', 'human'];
const REFERENCES = ['service', 'certificate', 'secret'];
const SENSITIVE = /password|passwd|secret|token|credential|private.?key|api.?key/i;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = field => { throw new CommandError('INVALID_INPUT', field); };
const badResponse = () => { throw new CommandError('INVALID_RESPONSE'); };

// No defaults or answered values are copied, including into private tool refs.
export function safeCatalogQuestions(input) {
  if ( !Array.isArray(input) || input.length > 100 ) { badResponse(); }
  const names = new Set();
  return input.map((question) => {
    if ( !object(question) || typeof question.name !== 'string' || !question.name || question.name.length > 128 || names.has(question.name) ||
      typeof question.type !== 'string' || !TYPES.includes(question.type) || typeof question.required !== 'boolean' ||
      typeof question.requiresHuman !== 'boolean' || typeof question.sourceType !== 'string' || question.sourceType.length > 64 ||
      typeof question.label !== 'string' || question.label.length > 256 || typeof question.description !== 'string' || question.description.length > 1024 ) { badResponse(); }
    names.add(question.name);
    const result = {name: question.name, type: question.type, label: question.label, description: question.description,
      required: question.required, requiresHuman: question.requiresHuman || question.type === 'human' ||
        ['password', 'masked'].includes(question.sourceType) || question.type !== 'reference' && SENSITIVE.test(question.name), sourceType: question.sourceType};
    if ( question.type === 'reference' ) {
      if ( !REFERENCES.includes(question.referenceType) ) { badResponse(); }
      result.referenceType = question.referenceType;
    }
    if ( question.type === 'enum' && !result.requiresHuman ) {
      if ( !Array.isArray(question.options) || question.options.length > 50 || question.options.some((value) => typeof value !== 'string' || value.length > 512) ) { badResponse(); }
      result.options = [...question.options];
    }
    for ( const field of ['minLength', 'maxLength', 'min', 'max'] ) {
      if ( question[field] === undefined ) { continue; }
      if ( typeof question[field] !== 'number' || !Number.isFinite(question[field]) ||
        ['minLength', 'maxLength'].includes(field) && (!Number.isSafeInteger(question[field]) || question[field] < 0 || question[field] > 4096) ) { badResponse(); }
      result[field] = question[field];
    }
    if ( result.minLength > result.maxLength || result.min > result.max ) { badResponse(); }
    return result;
  });
}

function assertVersion(version) {
  if ( !version || !TEMPLATE_ID.test(version.parentId || '') || !VERSION_ID.test(version.id || '') ) { invalid('catalogVersionRef'); }
}

export function catalogLaunchAnswers(answers, version, context, captured, resolveResource) {
  if ( !Array.isArray(answers) || answers.length > 100 ) { invalid('parameters.answers'); }
  if ( !version.catalogOptions || !version.catalogOptions.optionsRef ) { throw new CommandError('STALE_REFERENCE', 'catalogVersionRef'); }
  const values = Object.create(null), referenceBindings = Object.create(null), names = new Set();
  for ( const answer of answers ) {
    if ( !object(answer) || Object.keys(answer).some((field) => !['questionRef', 'value', 'resourceRef'].includes(field)) || typeof answer.questionRef !== 'string' ) { invalid('parameters.answers'); }
    const question = context.resolve(answer.questionRef, 'catalogQuestion', captured);
    if ( question.versionId !== version.id || question.templateId !== version.parentId || question.optionsRef !== version.catalogOptions.optionsRef ) {
      throw new CommandError('STALE_REFERENCE', 'catalogVersionRef');
    }
    if ( names.has(question.name) ) { invalid('parameters.answers'); }
    names.add(question.name);
    if ( question.requiresHuman ) { throw new CommandError('NEEDS_USER', 'parameters.answers'); }
    const hasValue = Object.prototype.hasOwnProperty.call(answer, 'value');
    const hasReference = Object.prototype.hasOwnProperty.call(answer, 'resourceRef');
    if ( hasValue === hasReference ) { invalid('parameters.answers'); }
    if ( question.type === 'reference' ) {
      if ( !question.required && hasValue && answer.value === '' ) { referenceBindings[question.name] = ''; continue; }
      if ( !hasReference || typeof answer.resourceRef !== 'string' ) { invalid('parameters.answers'); }
      const target = resolveResource ? resolveResource(answer.resourceRef, question.referenceType, captured) : context.resolve(answer.resourceRef, 'resource', captured);
      if ( target.resourceType !== question.referenceType || target.scope !== 'project' || typeof target.id !== 'string' ) { invalid('parameters.answers'); }
      referenceBindings[question.name] = target.id;
      continue;
    }
    if ( !hasValue || hasReference ) { invalid('parameters.answers'); }
    const value = answer.value;
    if ( ['string', 'enum'].includes(question.type) ) {
      if ( typeof value !== 'string' || value.length > (question.maxLength === undefined ? 4096 : question.maxLength) || value.includes('\u0000') ||
        question.minLength !== undefined && value.length < question.minLength || question.type === 'enum' && !question.options.includes(value) ) { invalid('parameters.answers'); }
    } else if ( question.type === 'boolean' ? typeof value !== 'boolean' :
      !['int', 'float'].includes(question.type) || typeof value !== 'number' || !Number.isFinite(value) ||
      question.type === 'int' && !Number.isSafeInteger(value) || question.min !== undefined && value < question.min || question.max !== undefined && value > question.max ) { invalid('parameters.answers'); }
    values[question.name] = value;
  }
  return {answers: values, referenceBindings};
}

export function createCatalogLaunchAdapter({request, context, resolveResource}) {
  async function call(collection, data, captured, signal) {
    context.assertCurrent(captured, signal);
    let response;
    try { response = await request({url: `projects/${encodeURIComponent(captured.projectId)}/${collection}`, method: 'POST', data, signal}); }
    catch (error) { context.assertCurrent(captured, signal); throw error; }
    context.assertCurrent(captured, signal);
    if ( !object(response && response.body) ) { badResponse(); }
    return response.body;
  }
  return Object.freeze({
    async options(version, captured, signal) {
      assertVersion(version);
      version.catalogOptions = null;
      const body = await call(CATALOG_OPTIONS_COLLECTION, {templateId: version.parentId, versionId: version.id}, captured, signal);
      if ( !OPTIONS_ID.test(body.optionsRef || '') || typeof body.launchEnabled !== 'boolean' ||
        !Array.isArray(body.requiredOperations) || body.requiredOperations.length !== 3 ||
        body.requiredOperations[0] !== 'read' || body.requiredOperations[1] !== 'create' || body.requiredOperations[2] !== 'update' ) { badResponse(); }
      const questions = safeCatalogQuestions(body.questions);
      version.catalogOptions = {optionsRef: body.optionsRef, launchEnabled: body.launchEnabled};
      return {launchEnabled: body.launchEnabled, requiredOperations: ['read', 'create', 'update'], authorization: 'requires-server-check', resourceTextIsUntrusted: true,
        questions: questions.map((question) => {
          const questionRef = context.reference('catalogQuestion', {...question, optionsRef: body.optionsRef, templateId: version.parentId, versionId: version.id}, captured);
          const {name, ...safe} = question;
          return {questionRef, ...safe};
        })};
    },
    async preview(version, parameters, captured, signal) {
      assertVersion(version);
      if ( !object(parameters) || Object.keys(parameters).some((field) => !['name', 'description', 'startOnCreate', 'answers'].includes(field)) ||
        typeof parameters.name !== 'string' || !/^[A-Za-z0-9-]{1,63}$/.test(parameters.name) ) { invalid('parameters.name'); }
      if ( !version.catalogOptions ) { throw new CommandError('STALE_REFERENCE', 'catalogVersionRef'); }
      if ( version.catalogOptions.launchEnabled !== true ) { throw new CommandError('UNAVAILABLE'); }
      if ( parameters.description !== undefined && (typeof parameters.description !== 'string' || parameters.description.length > 1024) ) { invalid('parameters.description'); }
      if ( parameters.startOnCreate !== undefined && typeof parameters.startOnCreate !== 'boolean' ) { invalid('parameters.startOnCreate'); }
      const bindings = catalogLaunchAnswers(parameters.answers || [], version, context, captured, resolveResource);
      const data = {templateId: version.parentId, versionId: version.id, optionsRef: version.catalogOptions.optionsRef,
        name: parameters.name, startOnCreate: parameters.startOnCreate === undefined ? true : parameters.startOnCreate, ...bindings};
      if ( parameters.description !== undefined ) { data.description = parameters.description; }
      return call(CATALOG_LAUNCH_COLLECTION, data, captured, signal);
    },
  });
}

export const CATALOG_LAUNCH_CHANGE_FIELDS = Object.freeze(['name', 'description', 'catalogTemplate', 'catalogVersion', 'serviceCount', 'volumeCount', 'startOnCreate', 'humanInputCount', 'referenceCount']);

export function catalogLaunchPlanSummary(plan, planRef) {
  if ( !object(plan) || !new RegExp(`^aicataloglaunch-${UUID}$`, 'i').test(plan.id || '') || !object(plan.summary) ||
    !['pending', 'approved', 'cancelled'].includes(plan.confirmationState) || typeof plan.inputsReady !== 'boolean' ||
    !['needs_user', 'accepted', 'running', 'succeeded', 'failed', 'unknown', 'cancelled'].includes(plan.status) ||
    !Array.isArray(plan.changes) || plan.changes.length > CATALOG_LAUNCH_CHANGE_FIELDS.length ) { badResponse(); }
  const summary = plan.summary;
  if ( typeof summary.stackName !== 'string' || summary.stackName.length > 63 || typeof summary.templateKey !== 'string' || summary.templateKey.length > 512 ||
    typeof summary.templateName !== 'string' || summary.templateName.length > 512 || typeof summary.catalogId !== 'string' || summary.catalogId.length > 512 ||
    !['global', 'project'].includes(summary.catalogScope) || typeof summary.version !== 'string' || summary.version.length > 512 ||
    summary.revision !== null && (!Number.isSafeInteger(summary.revision) || summary.revision < 0) ||
    !Number.isSafeInteger(summary.serviceCount) || summary.serviceCount < 0 || !Number.isSafeInteger(summary.volumeCount) || summary.volumeCount < 0 || typeof summary.startsServices !== 'boolean' ) { badResponse(); }
  const fields = new Set();
  const displayDiff = plan.changes.map((change) => {
    if ( !object(change) || !CATALOG_LAUNCH_CHANGE_FIELDS.includes(change.field) || fields.has(change.field) || change.before !== null ||
      !(change.after === null && change.field === 'description') && !['string', 'number', 'boolean'].includes(typeof change.after) || typeof change.after === 'string' && change.after.length > 1024 ||
      typeof change.after === 'number' && (!Number.isSafeInteger(change.after) || change.after < 0) ) { badResponse(); }
    if ( ['serviceCount', 'volumeCount', 'humanInputCount', 'referenceCount'].includes(change.field) && (!Number.isSafeInteger(change.after) || change.after < 0) ||
      change.field === 'startOnCreate' && typeof change.after !== 'boolean' || ['name', 'catalogTemplate', 'catalogVersion'].includes(change.field) && typeof change.after !== 'string' ||
      change.field === 'serviceCount' && change.after !== summary.serviceCount || change.field === 'volumeCount' && change.after !== summary.volumeCount ||
      change.field === 'name' && change.after !== summary.stackName || change.field === 'startOnCreate' && change.after !== summary.startsServices ) { badResponse(); }
    fields.add(change.field);
    return {field: change.field, before: null, after: change.after};
  });
  if ( !fields.has('startOnCreate') || !fields.has('serviceCount') || !fields.has('volumeCount') ) { badResponse(); }
  const missingHumanInputs = safeCatalogQuestions(plan.missingHumanInputs || []);
  if ( plan.inputsReady && missingHumanInputs.length ) { badResponse(); }
  return {planRef, planKind: 'catalog-launch', resourceType: 'stack', operation: 'create_from_catalog',
    displayPath: safeText(summary.stackName), displayDiff, expiresAt: safeText(plan.expiresAt, 64), confirmationState: plan.confirmationState,
    inputsReady: plan.inputsReady, planStatus: plan.status, verifiedResult: plan.verifiedResult === true, missingHumanInputCount: missingHumanInputs.length,
    catalogSummary: {stackName: summary.stackName, templateKey: summary.templateKey, templateName: summary.templateName, catalogScope: summary.catalogScope,
      catalogId: summary.catalogId, version: summary.version, revision: summary.revision, serviceCount: summary.serviceCount, volumeCount: summary.volumeCount, startsServices: summary.startsServices}};
}

import EmberObject from '@ember/object';
import { Promise } from 'rsvp';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';
import { xhrConcur } from 'ui/utils/platform';
import PromiseToCb from 'ui/mixins/promise-to-cb';
import { service } from '@ember/service';

export default Route.extend(PromiseToCb, {
  intl: service(),
  queryParams: {
    editing: {
      refreshModel: true
    }
  },

  model: function(params /* , transition*/) {
    var userStore = this.get('userStore');

    let policyManagerOpt = {
      headers: {
        [C.HEADER.PROJECT_ID]: params.project_id
      },
      filter: {
        name: C.CAPABILITY.NETWORK_POLICIES,
      },
    };

    let promise = new Promise((resolve, reject) => {
      let tasks = {
        allProjects:                        this.toCb(() => { return userStore.findAll('project'); }),
        project:            ['allProjects', this.toCb(() => {
          return userStore.find('project', params.project_id).then(null, (err) => {
            throw this.projectAccessError(err, 'viewEditProject.error.projectUnavailable');
          });
        })],
        importMembers:      ['project',     this.toCb((results) => {
          return results.project.followLink('projectMembers').then(
            (members) => {
              results.project.set('projectMembers', members);
              return results.project;
            },
            (err) => {
              throw this.projectAccessError(err, 'viewEditProject.error.membersUnavailable');
            }
          );
        })],
        networks:                           this.toCb(() => { return userStore.find('network', null, {filter: {accountId: params.project_id}}); }),
        policyManagers:                     this.toCb(() => { return userStore.find('stack', null, policyManagerOpt); }),
      };

      async.auto(tasks, xhrConcur, function(err, res) {
        if ( err ) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    }, 'Load all the things');

    return promise.then((hash) => {
      let network = hash.networks.find((x) => C.PROJECT.SUPPORTS_NETWORK_POLICY.includes(x.get('name')));
      if ( network ) {
        network = network.clone();

        if ( !network.get('defaultPolicyAction') ) {
          network.set('defaultPolicyAction', 'allow');
        }

        let policy = network.get('policy');
        if ( !policy ) {
          policy = [];
          network.set('policy', policy);
        }

        // Create default allow policies
        const fields = ['linked','service','stack'];
        fields.forEach((field) => {
          let rule = policy.findBy('within', field);
          if ( !rule ) {
            policy.pushObject(userStore.createRecord({
              type: 'networkPolicyRule',
              within: field,
              action: network.get('defaultPolicyAction'),
            }));
          }
        });
      }

      let out = EmberObject.create({
        all: hash.allProjects,
        network: network,
        policyManager: hash.policyManagers.objectAt(0),
      });

      if ( params.editing ) {
        out.setProperties({
          originalProject: hash.project,
          project: hash.project.clone(),
        });
      } else {
        out.setProperties({
          originalProject: null,
          project: hash.project,
        });
      }

      return out;
    });
  },

  projectAccessError(err, key) {
    let status = Errors.status(err);
    if ( status !== 403 && status !== 404 ) {
      return err;
    }

    // failWhale renders the status as well as the message. Present both a
    // denied and a missing resource identically; 401 and server failures keep
    // their original path.
    return {
      status: 404,
      message: this.get('intl').t(key),
    };
  },
});

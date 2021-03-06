const parseLocation = require('./util/parseLocation');
const api = require('./util/api');
const { addUserToGroup } = require('./group');

/**
 *  Public functions on object
 *  --------------------------
 *  getAllObjects(opts)
 *  addObject(opts)
 *  findObject(objectName, opts)
 */

module.exports = {
  async getAllObjects(opts) {
    return await this._findByType(opts, ['all']);
  },

  async addObject(opts) {
    let { name, location, object } = opts;
    location = parseLocation(location);
    object.cn = name;
    return this._addObject(`CN=${name}`, location, object);
  },

  async findObject(objectName, opts) {
    objectName = String(objectName || '');
    let { location } = opts;
    return new Promise(async (resolve, reject) => {
      const domain = this.config.domain
        .split('.')
        .map(o => 'dc=' + o)
        .join(',');
      const filter = `(&(cn=${objectName})(!(objectclass=user))(!(objectclass=group)))`;
      let params = {
        filter,
        includeMembership: ['all'],
        includeDeleted: false,
        attributes: '*'
      };
      if (location) {
        location = parseLocation(location);
        params.baseDN = location + domain;
      }
      this.ad.find(params, (err, results) => {
        if (err) {
          return reject(err);
        }
        if (!results || !results.other || results.other.length < 1) {
          return resolve();
        }
        results.other = api.processResults(opts, results.other);
        return resolve(results.other[0]);
      });
    });
  },

  async removeObject(objectName, opts) {
    return new Promise(async (resolve, reject) => {
      this.findObject(objectName, opts)
        .then(object => {
          if (
            object === undefined ||
            object === null ||
            Object.keys(object).length < 1
          ) {
            return reject({
              error: true,
              message: `Object ${objectName} does not exist.`
            });
          }
          return this._deleteObjectByDN(object.dn);
        })
        .then(resp => {
          return resolve(resp);
        })
        .catch(reject);
    });
  },

  async addToGroup(objectName, groupName, opts) {
    return new Promise(async (resolve, reject) => {
      this.findObject(objectName, opts).then(object => {
        if (
          object === undefined ||
          object == null ||
          Object.keys(object).length < 1
        ) {
          return reject({
            error: true,
            message: `Object ${objectName} does not exist.`
          });
        }
        this._groupAddOperation(groupName, {
          member: [object.dn]
        })
          .then(resp => {
            resolve(resp);
          })
          .catch(err => {
            reject(Object.assign(err, { error: true }));
          });
      });
    });
  },

  async setAttributes(objectName, opts, attributes) {
    return new Promise(async (resolve, reject) => {
      this.findObject(objectName, opts).then(object => {
        if (
          object === undefined ||
          object == null ||
          Object.keys(object).length < 1
        ) {
          return reject({
            error: true,
            message: `Object ${objectName} does not exist.`
          });
        }
        this._attributeUpdateOperation(objectName, opts, attributes)
          .then(resp => {
            resolve(resp);
          })
          .catch(err => {
            reject(Object.assign(err, { error: true }));
          });
      })
    })
  }
};

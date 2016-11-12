const Hapi = require('hapi');
const Boom = require('boom');

const environment = process.env.NODE_ENV || 'development';
const config = require('./knexfile.js')[environment];

const server = new Hapi.Server({
  connections: {
    routes: {
      cors: {
        origin: ['*'],
        additionalHeaders: ['x-requested-with']
      }
    }
  }
});

const db = require('knex')(config);
module.exports.db = db;

server.connection({port: process.env.PORT});

server.register(require('hapi-auth-jwt2'), function (err) {
  if (err) console.error(err);
  server.auth.strategy('jwt', 'jwt', {
    key: new Buffer(process.env.AUTH0_SECRET, 'base64'),
    validateFunc: function (decoded, request, callback) {
      if (decoded) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    verifyOptions: {
      algorithms: ['HS256'],
      audience: process.env.AUTH0_CLIENT_ID
    }
  });

  server.auth.default('jwt');

  /* Get all projects */
  server.route({
    method: 'GET',
    path: '/projects',
    config: {
      auth: {
        mode: 'optional'
      }
    },
    handler: function (req, res) {
      const roles = req.auth.credentials && req.auth.credentials.roles || [];
      const query = db('projects')
        .select('id', 'name', 'created_at', 'updated_at',
          db.raw('data->\'category\' as categories'),
          db.raw('data->\'location\' as location'));

      if (!req.auth.isAuthenticated) {
        return query.where('private', false).where('published', true).then(res);
      } else if (roles.indexOf('edit') === -1) {
        return query.where('published', true).select('private').then(res);
      } else {
        return query.select('private', 'published').then(res);
      }
    }
  });

  /* Create a new project */
  server.route({
    method: 'POST',
    path: '/projects',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const data = req.payload;
      const owner = req.auth.credentials.sub;
      const roles = req.auth.credentials.roles;
      const name = data.name;

      if (!owner || !data || !name) {
        return res(Boom.badData('Bad data'));
      }

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('projects')
        .returning('id')
        .insert({
          data: data,
          owner: owner,
          name: name,
          private: data.private || false,
          published: data.published || false,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        }).then(function (ret) {
          return res({id: ret[0]});
        })
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not add data'));
        });
    }
  });

  /* Get a single project */
  server.route({
    method: 'GET',
    path: '/projects/{id}',
    config: {
      auth: {
        mode: 'optional'
      }
    },
    handler: function (req, res) {
      return db('projects')
        .select()
        .where('id', req.params.id)
        .then(ret => {
          const roles = req.auth.credentials && req.auth.credentials.roles || [];
          if (roles.indexOf('edit') > -1 || // edit access can see everything
             (!ret[0].private && ret[0].published) || // public and published
             (req.auth.isAuthenticated && ret[0].private && ret[0].published) // also show authorized, private, published
           ) {
            return res(ret[0]);
          } else {
            return res(Boom.unauthorized('Not authorized to perform this action'));
          }
        })
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not find data'));
        });
    }
  });

  /* Update a single project */
  server.route({
    method: 'PUT',
    path: '/projects/{id}',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const data = req.payload;
      const roles = req.auth.credentials.roles;

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('projects')
        .where('id', req.params.id)
        .returning('id')
        .update({
          name: data.name,
          private: data.private || false,
          published: data.published || false,
          updated_at: db.fn.now(),
          data: data
        })
        .then((ret) => res({id: ret[0]}))
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not update data'));
        });
    }
  });

  /* Delete a single project */
  server.route({
    method: 'DELETE',
    path: '/projects/{id}',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const roles = req.auth.credentials.roles;

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('projects')
        .where('id', req.params.id)
        .del()
        .then((ret) => res({id: req.params.id}))
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not delete data'));
        });
    }
  });

  /* Get all indicators */
  server.route({
    method: 'GET',
    path: '/indicators',
    config: {
      auth: {
        mode: 'optional'
      }
    },
    handler: function (req, res) {
      const roles = req.auth.credentials && req.auth.credentials.roles || [];
      const query = db('indicators')
        .select('id', 'name', 'created_at', 'updated_at');

      if (!req.auth.isAuthenticated) {
        return query.where('private', false).where('published', true).then(res);
      } else if (roles.indexOf('edit') === -1) {
        return query.where('published', true).select('private').then(res);
      } else {
        return query.select('private', 'published').then(res);
      }
    }
  });

  /* Create a new indicator */
  server.route({
    method: 'POST',
    path: '/indicators',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const data = req.payload;
      const owner = req.auth.credentials.sub;
      const roles = req.auth.credentials.roles;
      const name = data.name;

      if (!owner || !data || !name) {
        return res(Boom.badData('Bad data'));
      }

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('indicators')
        .returning('id')
        .insert({
          data: data,
          owner: owner,
          name: name,
          private: data.private || false,
          published: data.published || false,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        }).then(function (ret) {
          return res({id: ret[0]});
        })
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not add data'));
        });
    }
  });

  /* Get a single indicator */
  server.route({
    method: 'GET',
    path: '/indicators/{id}',
    config: {
      auth: {
        mode: 'optional'
      }
    },
    handler: function (req, res) {
      return db('indicators')
        .select()
        .where('id', req.params.id)
        .then(ret => {
          const roles = req.auth.credentials && req.auth.credentials.roles || [];
          if (roles.indexOf('edit') > -1 || // edit access can see everything
             (!ret[0].private && ret[0].published) || // public and published
             (req.auth.isAuthenticated && ret[0].private && ret[0].published) // also show authorized, private, published
           ) {
            return res(ret[0]);
          } else {
            return res(Boom.unauthorized('Not authorized to perform this action'));
          }
        })
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not find data'));
        });
    }
  });

  /* Update a single indicator */
  server.route({
    method: 'PUT',
    path: '/indicators/{id}',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const data = req.payload;
      const roles = req.auth.credentials.roles;

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('indicators')
        .where('id', req.params.id)
        .returning('id')
        .update({
          name: data.name,
          private: data.private || false,
          published: data.published || false,
          updated_at: db.fn.now(),
          data: data
        })
        .then((ret) => res({id: ret[0]}))
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not update data'));
        });
    }
  });

  /* Delete a single indicator */
  server.route({
    method: 'DELETE',
    path: '/indicators/{id}',
    config: {auth: 'jwt'},
    handler: function (req, res) {
      const roles = req.auth.credentials.roles;

      if (roles.indexOf('edit') === -1) {
        return res(Boom.unauthorized('Not authorized to perform this action'));
      }

      return db('indicators')
        .where('id', req.params.id)
        .del()
        .then((ret) => res({id: req.params.id}))
        .catch(function (err) {
          console.error(err);
          return res(Boom.badImplementation('Internal Server Error - Could not delete data'));
        });
    }
  });
});

if (environment !== 'test') {
  server.start((err) => {
    if (err) { throw err; }
    console.log(`Server running at: ${server.info.uri}`);
  });
}

module.exports.server = server;

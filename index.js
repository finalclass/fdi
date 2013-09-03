var Try = require('try');

function log() {
  if (process.env.FDI_ENV === 'development') {
    console.log.apply(console, arguments);
  }
  return log;
}

module.exports.create = function () {
  /*~ We define the internal store for our resources with few helper functions such as
   `add(...)` or `get(...)` ...*/
  var store = {
    resources: Object.create(null),
    add: function (name, type, constructorFunction) {
      this.resources[name] = {
        name: name,
        type: type,
        constructorFunction: constructorFunction
      };
    },
    get: function (name) {
      return this.resources[name];
    },
    eachBean: function (callback, thisArg) {
      log('each bean function');
      Object.keys(this.resources).forEach(function forKeyInStore(key) {
        var objDefinition = this.resources[key];

        if (objDefinition.type === 'bean') {
          callback.call(thisArg, objDefinition);
        }
      }, this);
    }
  };

  return {
    log: log,
    initResource: function (resourceDefinition) {
      log('init resource', resourceDefinition.name);
      var t = resourceDefinition.constructorFunction.call(this, this);

      return t
      (function (instance) {
        resourceDefinition.instance = instance;
        log('resource instantiated ' + resourceDefinition.name);
        return instance;
      });
    },
    try: function (fn) {
      var t = new Try(fn);
      t.fdi = this;
      return t;
    },
    provide: function (provideFunction) {
      return this.try(provideFunction)
      (function () {
        log('for each bean');
        store.eachBean(function forEachBean(bean) {
          log('provide run init resource', bean.name);
          this.fdi.initResource(bean)(this.pause()).run();
        }, this);
      });
    },
    proto: function (name) {
      var t = this.try();
      store.add(name, 'proto', t);
      return t;
    },
    shared: function (name) {
      var t = this.try();
      store.add(name, 'shared', t);
      return t;
    },
    bean: function (name) {
      var t = this.try();
      store.add(name, 'bean', t);
      return t;
    },
    get: function (resources) {
      var di = this;
      var hash = Object.create(null);

      log('get all', resources);

      if (typeof resources === 'string') {
        return this.getOne(resources);
      }
      log('creating `get()` Try');
      return this.try
      (function () {
        log('pausing for ' + resources.length + ' executions');
        resources.forEach(function (resource) {
          log('get all for each at', resource);
          di.getOne(resource)(function (instance) {
              hash[resource] = instance;
            })(this.pause()).run();
        }, this);
      })
      (function () {
        return hash;
      });
    },
    getOne: function (name) {
      var di = this;

      log('getting', name);

      return this.try(function () {
        log('running `get()` Try');
        var resource = store.get(name);
        if (!resource) {
          throw new Error('Resource ' + name + ' not found in FDI');
        }

        if (resource.type === 'shared' && !resource.instance) {
          log('run initResource() for shared resource', resource.name);
          return di.initResource(resource)(this.pause()).run();
        } else if (resource.type === 'proto') {
          log('run initResource for proto resource', resource.name);
          return di.initResource(resource)(this.pause()).run();
        }

        log('returning instantiated ' + resource.type + ' resource', resource.name);

        /*~ if resource.type is `bean` the resource.instance is already present */
        return resource.instance;
      });
    }
  }
};
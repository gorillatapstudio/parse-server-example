
$(function() {

  Parse.$ = jQuery;

  Parse.initialize(config.parseAppId, config.parseJSClientKey);


  var FeedEntry = Parse.Object.extend("FeedEntry", {	
    
    initialize: function() {
    },

  });

  // This is the transient application state, not persisted on Parse
  var AppState = Parse.Object.extend("AppState", {
    defaults: {
      filter: "all"
    }
  });

  var FeedEntries = Parse.Collection.extend({
    model: FeedEntry,
    
  });

  var FeedEntryView = Parse.View.extend({
    tagName:  "li",
    template: _.template($('#item-template').html()),

    initialize: function() {
		_.bindAll(this, 'render');
		this.model.bind('change', this.render);
		//this.model.set({"imageUrl" : this.model.get("imageFile").url()});
		this.model.set(
		{
			"imageUrl" : this.model.get("imageFile") ? this.model.get("imageFile").url() : "",
			"userName" : this.model.get("user").get("name"),
			//"date" : (new Date()).getMilliseconds() - this.model.createdAt.getMilliseconds()
			"feedback" : 
				(this.model.get("nLikes") ? this.model.get("nLikes") + " laugh  " : "  ")
				+ (this.model.get("nComments") ? this.model.get("nComments")+ " comment" : ""),
		});

    },

    render: function() {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    },

  });

 var FeedEntriesView = Parse.View.extend({

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "click .log-out": "logOut",
    },

    el: ".content",

    initialize: function() {
      var self = this;

      _.bindAll(this, 'addOne', 'addAll', 'addSome', 'render', 'logOut');

      // Main todo management template
      this.$el.html(_.template($("#manage-todos-template").html()));
  
      this.feedEntries = new FeedEntries;

      this.feedEntries.query = new Parse.Query(FeedEntry);
      this.feedEntries.query.descending("createdAt");
      this.feedEntries.query.include("user");
        
      this.feedEntries.bind('add',     this.addOne);
      this.feedEntries.bind('reset',   this.addAll);
      this.feedEntries.bind('all',     this.render);

      this.feedEntries.fetch();

      state.on("change", this.filter, this);
    },

	logOut: function(e) {
      Parse.User.logOut();
      new LogInView();
      this.undelegateEvents();
      delete this;
    },

    render: function() {
      this.delegateEvents();
    },

    // Filters the list based on which type of filter is selected
    selectFilter: function(e) {
      var el = $(e.target);
      var filterValue = el.attr("id");
      state.set({filter: filterValue});
      Parse.history.navigate(filterValue);
    },

    filter: function() {
      var filterValue = state.get("filter");
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#" + filterValue).addClass("selected");
      if (filterValue === "all") {
        this.addAll();
      } else if (filterValue === "completed") {
        this.addSome(function(item) { return item.get('done') });
      } else {
        this.addSome(function(item) { return !item.get('done') });
      }
    },

    // Resets the filters to display all todos
    resetFilters: function() {
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#all").addClass("selected");
      this.addAll();
    },

    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(feedEntry) {
      var view = new FeedEntryView({model: feedEntry});
      this.$("#todo-list").append(view.render().el);
    },

    // Add all items in the Todos collection at once.
    addAll: function(collection, filter) {
      this.$("#todo-list").html("");
      this.feedEntries.each(this.addOne);
    },

    // Only adds some todos, based on a filtering function that is passed in
    addSome: function(filter) {
      var self = this;
      this.$("#todo-list").html("");
      this.todos.chain().filter(filter).each(function(item) { self.addOne(item) });
    },


  });

  var LogInView = Parse.View.extend({
    events: {
      "submit form.login-form": "logIn",
      "submit form.signup-form": "signUp"
    },

    el: ".content",
    
    initialize: function() {
      _.bindAll(this, "logIn", "signUp");
      this.render();
    },

    logIn: function(e) {
      var self = this;
      var username = this.$("#login-username").val();
      var password = this.$("#login-password").val();
      
      Parse.User.logIn(username, password, {
        success: function(user) {
          new FeedEntriesView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".login-form .error").html("Invalid username or password. Please try again.").show();
          self.$(".login-form button").removeAttr("disabled");
        }
      });

      this.$(".login-form button").attr("disabled", "disabled");

      return false;
    },

    signUp: function(e) {
      var self = this;
      var username = this.$("#signup-username").val();
      var password = this.$("#signup-password").val();
      
      Parse.User.signUp(username, password, { ACL: new Parse.ACL() }, {
        success: function(user) {
          new FeedEntriesView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".signup-form .error").html(error.message).show();
          self.$(".signup-form button").removeAttr("disabled");
        }
      });

      this.$(".signup-form button").attr("disabled", "disabled");

      return false;
    },

    render: function() {
      this.$el.html(_.template($("#login-template").html()));
      this.delegateEvents();
    }
  });

  // The main view for the app
  var AppView = Parse.View.extend({
      el: $("#todoapp"),

    initialize: function() {
      this.render();
    },

    render: function() {
      if (!config.requireLogIn || Parse.User.current()) {
        new FeedEntriesView();
      } else {
        new LogInView();
      }
    }
  });

  var AppRouter = Parse.Router.extend({
    routes: {
      "all": "all",
      "active": "active",
      "completed": "completed"
    },

    initialize: function(options) {
    },

    all: function() {
      state.set({ filter: "all" });
    },

    active: function() {
      state.set({ filter: "active" });
    },

    completed: function() {
      state.set({ filter: "completed" });
    }
  });

  var state = new AppState;

  new AppRouter;
  new AppView;
  Parse.history.start();
});

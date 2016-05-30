var common = require('./cloudfunction/common.js');
var push = require('./cloudfunction/push_notification.js');
var integrity = require('./cloudfunction/data_integrity.js');
var jobs = require('./cloudfunction/background_jobs.js');
var migration = require('./cloudfunction/data_migration.js');
var init = require('./cloudfunction/init_classes.js');
var linkImporter = require('./cloudfunction/link_importer.js');


//Parse.Cloud.define("migrate", common.getFuncSeries(migration.recomputeFeedbackPoints));
//Parse.Cloud.job("migrate", common.getFuncSeries(migration.bigMigrationSeries));
Parse.Cloud.define("migrate", common.getFuncSeries(migration.bigMigrationSeries));
Parse.Cloud.define("integrity", common.getFuncParallel(integrity.deleteGhostObject));
Parse.Cloud.define("oneFunc", common.getFuncSeries(function() {
		return [migration.changeACL];
	}))
	
	
Parse.Cloud.define("initialize", function(request, response) {
	var editions = {
		"names" : ["English Only", "Chinese Only", "All Languages"],
		"names_zh" : ["英语", "中文", "所有语言"],
		"titleNames" : ["DogOrCat β", "猫猫狗狗 β", "Dog猫狗Cat"],
		"languages" : ["en", "zh", "all"],
		"namesMatched" : []};
	
	var hashtags = {
		"names" : ["all", "#Dog", "#Cat", "#Others"],
		"names_zh" : ["所有", "#狗", "#猫","#其他"]};
	
	var timetags = {
		"names" : ["All time", "3 hours", "1 day", "3 days", "1 week", "1 month", "1 year"],
		"names_zh" : ["所有", "3小时", "1天", "3天", "1周", "1个月", "1年"],
		"periods" : [-1, 3, 24, 72, 168, 720, 8760],
		"isDefaultIndex" : 4};
	init.initialize(request, response, editions, hashtags, timetags);
});
	
Parse.Cloud.define("addUsersToRole", function(request, response) {
	var map = {
		"Administrator":["davidshen2001@hotmail.com", "gorillatapstudio@gmail.com"],
		"ContentPublisher" : ["cp@gmail.com"],
		"ContentModerator":["cm@gmail.com", "davidshen2001@hotmail.com", "gorillatapstudio@gmail.com"],
		"ContentTester":["ct@gmail.com"]};
	
	init.addUsersToRole(request, response, map);
});

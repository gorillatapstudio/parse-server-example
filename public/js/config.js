
var config_all = {
	1:	{
			appId: 1,
			appTitle: "DogOrCat",
			parseAppId : "6p9knT2DTN5VVp0vdPzFZauf90mdApL9nHJFyS2M",
			parseJSClientKey : "wxrhhCT6TnThx3WUMN3bmcagroGzSXQcNKdmLi0l",
			requireLogIn: false,
		}};
	
	
var appId = 1;//getParameterByName("appid");

var config = config_all[appId];

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
};

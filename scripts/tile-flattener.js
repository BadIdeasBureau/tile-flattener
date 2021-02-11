

//TODO:  Options for whether to include hidden tiles/drawings
//Convert this into, like, a thing that makes an actual file (as a webp, if possible), and then set as scene background
//Make a dialog box with the appropriate doohickeys, put button to make this happen in tiles menu
//Also option to clear "mystery man" tokens when flattened, for TA compatibility (and check in #compatibility for the safest way to do this with TA/ST)

//Button Maker

Hooks.on("getSceneControlButtons", addFlattenerButton);

function addFlattenerButton(buttons) {
	let tilesButton = buttons.find(b => b.name == "tiles")
	if (tilesButton) {
		tilesButton.tools.push({
			name: "request-roll",
			title: game.i18n.localize('TILE-FLATTENER.Button'),
			icon: "fas fa-layer-group",
			visible: game.user.isGM,
			onClick: () => flattenTilePrompt(),
            button: true
		});
	}
};

async function flattenTilePrompt(){
	let d = new Dialog({
		title: "Test Dialog",
		content: "<p>You must choose either Option 1, or Option 2</p>", //should include HTML elements for the various settings
		buttons: {
		 one: {
		  icon: '<i class="fas fa-check"></i>',
		  label: "Option One",
		  callback: (html) => console.log("thing")//parse settings from the HTML, assemble into a layerSettings object, and then pass to flattenTiles
		 },
		 two: {
		  icon: '<i class="fas fa-times"></i>',
		  label: "Option Two",
		  callback: () => console.log("Chose Two")
		 }
		},
		default: "two",
		render: html => console.log("Register interactivity in the rendered dialog"),
		close: html => console.log("This always is logged no matter which option is chosen")
	   });
	   d.render(true);
}

async function flattenTiles(layerSettings) {
	let layers = [];
	if(layerSettings.background) layers.push("background");
	if(layerSettings.tiles) layers.push("tiles");
	if(layerSettings.drawings) layers.push("drawings")
	container = new PIXI.Container();
	const layers = ["background", "tiles", "drawings"];
	for (let layer of layers) {
   		container.addChild(canvas[layer]);
	}
	// filtering:  https://discord.com/channels/732325252788387980/732325252788387983/809475839707971594
	//short version:  canvas[layer].objects.children, and then mess with that array (don't use .delete(), since that actually deletes the tile from the database)
	//or set the "visible" boolean to false within each child.
	//Advantage of array method is that there is then an array of all tiles which have been flattened, which can then be used with canvas[layer].deleteMany([ids])
	containerToBlobAndUpload(container, filename);
};

async function containerToBlobAndUpload(container, filename){
	canvas.app.renderer.extract.canvas(container).toBlob(function (b) {
		uploadToFoundry(b, filename);
	}, "image/webp");
}
static function getUploadPath(){
	return "worlds/" + game.world.name + "/TileFlattenerData";
}

async function uploadToFoundry(data,filename){ //Original bay KayelGee in DrawingTokenizer
	// Create the form data to post
	const fd = new FormData();
	const path = getUploadPath();
	let test = await data;
	fd.set("source", 'data');
	fd.set("target", path);
	fd.set("upload", test, filename);

	// Dispatch the request
	const request = await fetch('/upload', {method: "POST", body: fd});
	if ( request.status === 413 ) {
		return ui.notifications.error(game.i18n.localize("FILES.ErrorTooLarge"));
	} else if ( request.status !== 200 ) {
		return ui.notifications.error(game.i18n.localize("FILES.ErrorSomethingWrong"));
	}

	// Retrieve the server response
	const response = await request.json();
	if (response.error) {
		ui.notifications.error(response.error);
		return false;
	} else if (response.message) {
		if ( /^(modules|systems)/.test(response.path) ) {
			ui.notifications.warn(game.i18n.localize("FILES.WarnUploadModules"))
		}
		ui.notifications.info(response.message);
	}
	return response;
}


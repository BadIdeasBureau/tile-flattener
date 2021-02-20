

//TODO:  Module compatibility
//Copy to Teech#7953 when alpha ready

Hooks.on("init", initHook)

function initHook(){
	makeFolder();
	registerSettings();
}

function registerSettings(){ //todo - split this out into its own file later maybe
	game.settings.register("tile-flattener","hiddenTiles", {
		name: game.i18n.localize('TILE-FLATTENER.Settings.HiddenTiles'),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("tile-flattener","hiddenDrawings", {
		name: game.i18n.localize('TILE-FLATTENER.Settings.HiddenDrawings'),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("tile-flattener","deleteFlattened", {
		name: game.i18n.localize('TILE-FLATTENER.Settings.deleteFlattened'),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}

Hooks.on("getSceneControlButtons", addFlattenerButton); //add the button for this to the menu

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

async function flattenTilePrompt(){ //displays the prompt to get settings for this flattening
	const autofilename = canvas.scene.name.toLowerCase().replaceAll(/[\/\?<>\\:\*\|":]/g, '') + "-" + canvas.scene._id; //scene name - scene ID (sanitised for filename stuff)
	const content = 	"\n"+ 
						game.i18n.localize('TILE-FLATTENER.Dialog.Content') +
						"\n <div class='form-group dialog layer-settings'>" +
						"\n <label>Background:</label> <input type='checkbox' name='background' checked />"+
						"\n <label>Tiles:</label> <input type='checkbox' name='tiles' checked />"+ //for now, "exclude hidden" and "exclude module" can be settings.  Might move them into here later
						"\n <label>Drawings:</label> <input type='checkbox' name='drawings' />"+
						"\n </div>"+
						"\n <div class='form-group dialog layer-settings'>"+
						"\n <label>Filename:</label> <div class='flexrow'><input type='text' name='filename' value='' placeholder='"+autofilename+"' />"+".webp</div>"+ //pattern match doesn't seem to do anything, but can sanitise later
						"\n </div>" //todo:  make this look nicer
	let d = new Dialog({
		title: game.i18n.localize('TILE-FLATTENER.Dialog.Title'),
		content: content,
		buttons: {
		 one: {
		  icon: '<i class="fas fa-check"></i>',
		  label: game.i18n.localize('TILE-FLATTENER.Dialog.Button'),
		  callback: html => { //parse settings from the HTML, assemble into a layerSettings object, and then pass to flattenTiles
				const background = html.find(".layer-settings.dialog [name='background']")[0].checked;
				const tiles = html.find(".layer-settings.dialog [name='tiles']")[0].checked;
				const drawings = html.find(".layer-settings.dialog [name='drawings']")[0].checked;
				const layerSettings = {background: background, tiles: tiles, drawings: drawings};
				const filename = html.find(".layer-settings.dialog [name='filename']")[0].value;
				if (!filename) {filename=autofilename} else {filename.replaceAll(/[\/\?<>\\:\*\|":]/g, '')};
				filename=filename+".webp"
				flattenTiles(layerSettings, filename)
				
			}
		 }
		},
		default: "one",
	   });
	   d.render(true);
}

async function flattenTiles(layerSettings, filename) { //Do the actual flattening of the tiles.
	let layers = [];
	if(layerSettings.background) layers.push("background");
	if(layerSettings.tiles) layers.push("tiles");
	if(layerSettings.drawings) layers.push("drawings")
	container = new PIXI.Container();
	for (let layer of layers) {
   		await container.addChild(canvas[layer]);
	}
	if (container.children.length === 0) return; //if nothing in the canvas to save, return
	//filtering:
	let tiles = container.children.find(a=>a.name==="TilesLayer")?.objects?.children;
	tiles = tiles?.filter(filterTilesLayer); //do the filtering on the tiles layer
	const tileIDs = tiles.map(t=> t.id) //grab ids of all flattened tiles
	let drawings = container.children.find(a=>a.name==="DrawingsLayer")?.objects?.children;
	drawings = drawings?.filter(filterDrawingsLayer);
	const drawIDs = drawings.map(d=> d.id); //grab IDs of all flattened drawings

	// filtering:  https://discord.com/channels/732325252788387980/732325252788387983/809475839707971594
	//short version:  canvas[layer].objects.children, and then mess with that array (don't use .delete(), since that actually deletes the tile from the database)
	//or set the "visible" boolean to false within each child.
	//Advantage of array method is that there is then an array of all tiles which have been flattened, which can then be used with canvas[layer].deleteMany([ids])
	await containerToBlobAndUpload(container, filename);
	await canvas.scene.update({img: getUploadPath() + "/" + filename}) //set image as scene background
	canvas = new Canvas(); //re-initialise the canvas, because we've ripped most of it out
	canvas.draw(); //redraw the new canvas
	if(game.settings.get("tile-flattener","deleteFlattened")){
		canvas.tiles.deleteMany(tileIDs);
		canvas.drawings.deleteMany(drawIDs);
	}

};

async function filterTilesLayer(tile){ //function to pass to array.filter for the tile array - add additional checks/settings here. Should return true for tiles to keep, false for tiles to drop.
	if(tile.data.hidden && !game.settings.get("tile-flattener","hiddenTiles")){
		return false;
	}
	return true;
}

async function filterDrawingsLayer(drawing){ //function to pass to array.filter for the drawings array - add additional checks/settings here. Should return true for drawings to keep, false for drawings to drop.
	if(drawing.data.hidden && !game.settings.get("tile-flattener","hiddenDrawings")){
		return false;
	}
	return true;
}

async function containerToBlobAndUpload(container, filename){
	canvas.app.renderer.extract.canvas(container).toBlob(function (b) {
		await uploadToFoundry(b, filename);
	}, "image/webp");
}

async function uploadToFoundry(data,filename){ //Original by KayelGee in DrawingTokenizer
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

async function makeFolder(){
	const worldFolder = await FilePicker.browse("data", "worlds/" + game.world.name);
	const uploadPath = getUploadPath();
	if (!worldFolder.dirs.some(s => s.includes ("/TileFlattenerData"))) await FilePicker.createDirectory("data", uploadPath)
}

function getUploadPath(){
	return "worlds/" + game.world.name + "/TileFlattenerData";
}
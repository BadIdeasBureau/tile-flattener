

//TODO:  Options for whether to include hidden tiles/drawings
//Convert this into, like, a thing that makes an actual file (as a webp, if possible), and then set as scene background
//Make a dialog box with the appropriate doohickeys, put button to make this happen in tiles menu
//Also option to clear "mystery man" tokens when flattened, for TA compatibility (and check in #compatibility for the safest way to do this with TA/ST)

//Button Maker

function getSceneControlButtons(buttons) {
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

async function canvasToContainer() {
	container = new PIXI.Container();
	const layers = ["background", "tiles", "drawings"];

	for (let layer of layers) {
   		container.addChild(canvas[layer]);
	}
	return container;
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


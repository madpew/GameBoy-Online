"use strict";
var gameboy = null;						//GameBoyCore object.
var gbRunInterval = null;				//GameBoyCore Timer
var settings = [						//Some settings.
	true, 								//Turn on sound.
	false,								//Boot with boot ROM first?
	false,								//Give priority to GameBoy mode
	0.8,								//Volume level set.
	true,								//Colorize GB mode?
	false,								//Disallow typed arrays?
	8,									//Interval for the emulator loop.
	10,									//Audio buffer minimum span amount over x interpreter iterations.
	20,									//Audio buffer maximum span amount over x interpreter iterations.
	false,								//Override to allow for MBC1 instead of ROM only (compatibility for broken 3rd-party cartridges).
	false,								//Override MBC RAM disabling and always allow reading and writing to the banks.
	false,								//Use the GameBoy boot ROM instead of the GameBoy Color boot ROM.
	false,								//Scale the canvas in JS, or let the browser scale the canvas?
	false,								//Use image smoothing based scaling?
    [true, true, true, true]            //User controlled channel enables.
];

var keyZones = [
	["right", [39]],
	["left", [37]],
	["up", [38]],
	["down", [40]],
	["a", [88, 87, 74, 83, 32]],
	["b", [90, 81, 89, 65]],
	["select", [16]],
	["start", [13]]
];

var gameboyColors = [0xacb56b, 0x768448, 0x4f604f, 0x344147];

function findCanvas()
{
	return document.getElementById("gameboy-canvas");
}

function loadBinaryRom(romFilePath)
{
	var xhr = new XMLHttpRequest(); 
	xhr.open("GET", romFilePath); 
	xhr.responseType = 'arraybuffer';

	xhr.onload = function(e) 
	{
		if (this.status == 200) {
			var responseArray = new Uint8Array(this.response); 
            start(findCanvas(), responseArray);
        }
	}
	
	xhr.send();
}

function loadBase64Rom(romString)
{
	var raw = window.atob(romString);
	var rawLength = raw.length;
	var array = new Uint8Array(new ArrayBuffer(rawLength));

	for(var i = 0; i != rawLength; i++) {
		array[i] = raw.charCodeAt(i);
	}

	start(findCanvas(), array);
}

function keyDown(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				GameBoyKeyDown(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}

function keyUp(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				GameBoyKeyUp(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}

function addEvent(sEvent, oElement, fListener) {
	try {	
		oElement.addEventListener(sEvent, fListener, false);
	}
	catch (error) {
		oElement.attachEvent("on" + sEvent, fListener);	//Pity for IE.
	}
}

function start(canvas, ROM) {
	
	addEvent("keydown", document, keyDown);
	addEvent("keyup", document,  keyUp);
	
	clearLastEmulation();
	gameboy = new GameBoyCore(canvas, ROM);
	gameboy.start();
	run();
}

function run() {
	if (GameBoyEmulatorInitialized()) {
		if (!GameBoyEmulatorPlaying()) {
			gameboy.stopEmulator &= 1;
			var dateObj = new Date();
			gameboy.firstIteration = dateObj.getTime();
			gameboy.iterations = 0;
			gbRunInterval = setInterval(function () {
				if (!document.hidden && !document.msHidden && !document.mozHidden && !document.webkitHidden) {
					gameboy.run();
				}
			}, 8);
		}
	}
}

function pause() {
	if (GameBoyEmulatorInitialized()) {
		if (GameBoyEmulatorPlaying()) {
			//autoSave();
			clearLastEmulation();
		}
	}
}

function clearLastEmulation() {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		clearInterval(gbRunInterval);
		gameboy.stopEmulator |= 2;
	}
}

function matchKey(key) {	//Maps a keyboard key to a gameboy key.
	//Order: Right, Left, Up, Down, A, B, Select, Start
	var keymap = ["right", "left", "up", "down", "a", "b", "select", "start"];	//Keyboard button map.
	for (var index = 0; index < keymap.length; index++) {
		if (keymap[index] == key) {
			return index;
		}
	}
	return -1;
}
function GameBoyEmulatorInitialized() {
	return (typeof gameboy == "object" && gameboy != null);
}
function GameBoyEmulatorPlaying() {
	return ((gameboy.stopEmulator & 2) == 0);
}
function GameBoyKeyDown(key) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		GameBoyJoyPadEvent(matchKey(key), true);
	}
}
function GameBoyJoyPadEvent(keycode, down) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		if (keycode >= 0 && keycode < 8) {
			gameboy.JoyPadEvent(keycode, down);
		}
	}
}
function GameBoyKeyUp(key) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		GameBoyJoyPadEvent(matchKey(key), false);
	}
}
//The emulator will call this to sort out the canvas properties for (re)initialization.
function initNewCanvas() {
	if (GameBoyEmulatorInitialized()) {
		gameboy.canvas.width = gameboy.canvas.clientWidth;
		gameboy.canvas.height = gameboy.canvas.clientHeight;
	}
}
//Call this when resizing the canvas:
function initNewCanvasSize() {
	if (GameBoyEmulatorInitialized()) {
		if (!settings[12]) {
			if (gameboy.onscreenWidth != 160 || gameboy.onscreenHeight != 144) {
				gameboy.initLCD();
			}
		}
		else {
			if (gameboy.onscreenWidth != gameboy.canvas.clientWidth || gameboy.onscreenHeight != gameboy.canvas.clientHeight) {
				gameboy.initLCD();
			}
		}
	}
}

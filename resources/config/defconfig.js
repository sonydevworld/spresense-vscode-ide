/* --------------------------------------------------------------------------------------------
 * Copyright 2019 Sony Semiconductor Solutions Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 * --------------------------------------------------------------------------------------------
 */

/**
 * Show SDK defconfig selection dialog
 * 
 * @param {string[]} deflist List of default configs, formatted as "<category>/<name>".
 * @param {Function} callback Call when "OK" or "Cancel" button is pressed, button status
 * 		and selected defconfigs will be passed.
 */

function showSdkDefconfigSelection(deflist, callback) {
	var modal = document.getElementById("defconfig");
	var list = document.getElementById("defconfig-list");
	let slist = document.getElementById("selected-defconfig-list");

	var device = document.createElement("div");
	var feature = document.createElement("div");
	var examples = document.createElement("div");

	device.id = "defconfig-device";
	device.style.display = "block";
	feature.id = "defconfig-feature";
	feature.style.display = "none";
	examples.id = "defconfig-examples";
	examples.style.display = "none";

	list.appendChild(device);
	list.appendChild(feature);
	list.appendChild(examples);

	let onselected = (event) => {
		if (event.target.classList.contains("active")) {
			for (var e of slist.childNodes) {
				if (e.innerHTML === event.target.dataset.exactName) {
					slist.removeChild(e);
					break;
				}
			}
			event.target.classList.remove("active");
		} else {
			var e = document.createElement("div");
			e.innerHTML = event.target.dataset.exactName;
			slist.appendChild(e);
			event.target.classList.add("active");
		}
	};

	for (let c of deflist) {
		var e = document.createElement("div");
		// '-defconfig' is old defconfig file structure, '/defconfig' is SDK 2.0 and above.
		c = c.replace("-defconfig", "").replace("/defconfig", "");
		var def = c.split("/");

		e.dataset.exactName = c;
		e.classList.add("defconfig-item");
		e.innerHTML = def[1];
		e.addEventListener("click", onselected);

		switch (def[0]) {
			case "device":
				device.appendChild(e);
				break;
			case "feature":
				feature.appendChild(e);
				break;
			case "examples":
				examples.appendChild(e);
				break;
		}
	}

	var deviceBtn = document.getElementById("category-device");
	var featureBtn = document.getElementById("category-feature");
	var examplesBtn = document.getElementById("category-examples");

	// Select device tab as default.
	deviceBtn.classList.add("active");
	featureBtn.classList.remove("active");
	examplesBtn.classList.remove("active");

	let handleTab = (event) => {
		let tabs = [
			{ button: deviceBtn, content: device },
			{ button: featureBtn, content: feature },
			{ button: examplesBtn, content: examples },
		];

		for (let t of tabs) {
			if (event.target.id === t.button.id) {
				t.button.classList.add("active");
				t.content.style.display = "block";
			} else {
				t.button.classList.remove("active");
				t.content.style.display = "none";
			}
		}
	};

	deviceBtn.addEventListener("click", handleTab);
	featureBtn.addEventListener("click", handleTab);
	examplesBtn.addEventListener("click", handleTab);

	let okBtn = document.getElementById("defconfig-ok");
	let cancelBtn = document.getElementById("defconfig-cancel");

	let removeEventListeners = () => {
		okBtn.removeEventListener("click", handleOk);
		cancelBtn.removeEventListener("click", handleCancel);
		deviceBtn.removeEventListener("click", handleTab);
		featureBtn.removeEventListener("click", handleTab);
		examplesBtn.removeEventListener("click", handleTab);
	};

	let clearLists = () => {
		while (list.lastChild) {
			list.removeChild(list.lastChild);
		}
		while (slist.lastChild) {
			slist.removeChild(slist.lastChild);
		}
	};

	let handleOk = (event) => {
		modal.style.display = "none";

		let selected = [];

		for (var e of slist.childNodes) {
			selected.push(e.innerHTML);
		}

		removeEventListeners();
		clearLists();

		callback("ok", selected.join('\n'));
	};

	let handleCancel = (event) => {
		modal.style.display = "none";

		removeEventListeners();
		clearLists();

		callback("cancel", undefined);
	};

	okBtn.addEventListener("click", handleOk);
	cancelBtn.addEventListener("click", handleCancel);

	document.getElementById("defconfig-kernel").style.display = "none";
	modal.style.display = "block";
}

/**
 * Show kernel defconfig select dialog
 *
 * @param {string[]} deflist List of kernel default config filenames, it formatted as
 * 		"kernel/<name>".
 * @param {Function} callback Call when "OK" or "Cancel" button is pressed, button status
 * 		and selected defconfigs will be passed.
 */

function showKernelDefconfigSelection(deflist, callback) {
	var modal = document.getElementById("defconfig");
	var list = document.getElementById("defconfig-kernel");

	let onselected = (event) => {
		for (let e of event.target.parentNode.childNodes) {
			if (e === event.target) {
				e.classList.add("active");
			} else {
				e.classList.remove("active");
			}
		}
	};

	for (let c of deflist) {
		var e = document.createElement("div");
		c = c.replace("-defconfig", "");
		var def = c.replace("kernel/", "");

		e.dataset.exactName = c;
		e.classList.add("defconfig-item");
		e.innerHTML = def;
		e.addEventListener("click", onselected);

		// "release" defconfig is default
		if (def === "release") {
			e.classList.add("active");
		}

		list.appendChild(e);
	}

	let okBtn = document.getElementById("defconfig-ok");
	let cancelBtn = document.getElementById("defconfig-cancel");

	let removeEventListeners = () => {
		okBtn.removeEventListener("click", handleOk);
		cancelBtn.removeEventListener("click", handleCancel);
	};

	let clearLists = () => {
		while (list.lastChild) {
			list.removeChild(list.lastChild);
		}
	};

	let handleOk = (event) => {
		modal.style.display = "none";

		let selected;
		for (let e of list.childNodes) {
			if (e.classList.contains("active")) {
				selected = e.dataset.exactName;
				break;
			}
		}

		removeEventListeners();
		clearLists();

		callback("ok", selected);
	};

	let handleCancel = (event) => {
		modal.style.display = "none";

		removeEventListeners();
		clearLists();

		callback("cancel", undefined);
	};

	okBtn.addEventListener("click", handleOk);
	cancelBtn.addEventListener("click", handleCancel);

	modal.querySelectorAll("#defconfig-selector, #defconfig-selected").forEach((v, k, p) => {
		v.classList.add("hide");
	});

	modal.style.display = "block";
}

/*
 * The Modal class
 *
 * This class controls modal dialog box. This class has header, content and footer
 * frames, and their handling logic.
 *
 * Header frame holds modal title.
 * Footer frame holds OK and cancel button.
 * Content is a place holder, it will be replaced by @a contentobj.
 */

class Modal {
	constructor(contentobj, deflist, callback) {
		this._element = document.querySelector("#defconfig > .modal-content");

		// Create content and replace it to old "defconfig-body" tag
		this.content = new contentobj(deflist);
		let old = document.getElementById("defconfig-body");
		this._element.replaceChild(this.content.body, old);

		// Create new OK and cancel button. This process is for simplified
		// the event handler control.
		let ok = document.createElement("div");
		ok.id = "defconfig-ok";
		ok.innerHTML = "OK";
		let cancel = document.createElement("div");
		cancel.id = "defconfig-cancel";
		cancel.innerHTML = "Cancel";

		ok.addEventListener("click", () => {
			this.content.handleOk(callback);
			this.hide();
		});

		cancel.addEventListener("click", () => {
			callback("cancel", undefined);
			this.hide();
		});

		document.getElementById("defconfig-ok").replaceWith(ok);
		document.getElementById("defconfig-cancel").replaceWith(cancel);
	}

	show() {
		document.getElementById("defconfig").style.display = "block";
	}

	hide() {
		document.getElementById("defconfig").style.display = "none";
	}
}

/*
 * Defconfig selection dialog content object
 *
 * This class is dialog content for Modal class.
 * This class is for SDK 2.0.
 */

class DefconfigDialogContent {
	constructor(deflist) {
		this.body = document.createElement("div");
		this.body.id = "defconfig-body";

		let selector = document.createElement("div");
		selector.id = "defconfig-selector";

		this.tab = document.createElement("div");
		this.tab.id = "defconfig-category";
		this.list = document.createElement("div");
		this.list.id = "defconfig-list";
		selector.append(this.tab, this.list);

		let selected = document.createElement("div");
		selected.id = "defconfig-selected";
		let p = document.createElement("p");
		p.innerHTML = "Selected defconfigs";
		let list = document.createElement("div");
		list.id = "selected-defconfig-list";
		selected.append(p, list);

		// Add selector and selected window to dialog body.
		// body property will be placed at modal content tag ("defconfig-body").
		let upper = document.createElement("div");
		upper.id = "defconfig-body-upper";
		upper.append(selector, selected);
		let lower = document.createElement("div");
		lower.id = "defconfig-body-lower";
		let desc = document.createElement("p");
		desc.id = "defconfig-desc";
		lower.append(desc);
		this.body.append(upper, lower);

		// TENTATIVE:
		//this._createCategoryList("Kernel", "spresense/configs/", deflist, false);
		this._createCategoryList("Device", "device/", deflist, true);
		this._createCategoryList("Feature", "feature/", deflist, false);
		this._createCategoryList("Examples", "examples/", deflist, false);
	}

	_createTabItem(name, active) {
		let e = document.createElement("div");
		e.id = "category-" + name.toLowerCase();
		e.className = "tabitem";
		e.innerHTML = name;
		e.dataset.active = active ? "true" : "false";
		e.addEventListener("click", this.tabClicked);
		return e;
	}

	_createCategoryList(name, prefix, deflist, active) {
		this.tab.appendChild(this._createTabItem(name, active));
		let defconfiglist = document.createElement("div");
		defconfiglist.id = "defconfig-list-" + name.toLowerCase();
		defconfiglist.style.display = active ? "block" : "none";

		let l = deflist.filter(c => c.defconfig.startsWith(prefix));
		l.forEach(c => {
			let e = document.createElement("div");
			e.dataset.exactName = c.defconfig;
			e.classList.add("defconfig-item");
			e.innerHTML = c.defconfig.replace(prefix, "").replace("/defconfig", "");
			e.dataset.desc = c.desc;
			e.addEventListener("click", this.defconfigClicked);
			e.addEventListener("mouseover", this.showDescription);
			defconfiglist.appendChild(e);
		});
		this.list.appendChild(defconfiglist);
	}

	/*
	 * Event handler for tab click event
	 *
	 * Switch clicked tab to be active and deactivate other tabs.
	 */

	tabClicked(event) {
		document.getElementById("defconfig-category").childNodes.forEach(node => {
			if (node === event.target) {
				node.dataset.active = "true";
				document.getElementById(node.id.replace("category-", "defconfig-list-")).style.display = "block";
			} else {
				node.dataset.active = "false";
				document.getElementById(node.id.replace("category-", "defconfig-list-")).style.display = "none";
			}
		});
	}

	/*
	 * Event handler for defconfig item click event
	 *
	 * Copy clicked defconfig to selected list, or remove defconfig from selected list when
	 * it is selected.
	 */

	defconfigClicked(event) {
		let list = document.getElementById("selected-defconfig-list");
		if (event.target.dataset.active === "true") {
			list.removeChild(list.querySelector(`div[data-exact-name="${event.target.dataset.exactName}"]`));
			event.target.dataset.active = "false";
		} else {
			let c = document.querySelector("#defconfig-category > .tabitem[data-active=true]");
			let e = document.createElement("div");

			e.dataset.exactName = event.target.dataset.exactName;
			e.innerHTML = `${c.innerHTML}/${event.target.innerHTML}`;
			list.appendChild(e);
			event.target.dataset.active = "true";
		}
	}

	/*
	 * Event handler for defconfig item mouseover event
	 *
	 * Show defconfig description at the bottom of dialog.
	 */

	showDescription(event) {
		let frame = document.getElementById("defconfig-desc");
		frame.innerText = event.target.dataset.desc;
	}

	/*
	 * Handle event when OK button is clicked
	 *
	 * In this class, gather selected defconfigs and they concatnate with '\n',
	 * and callback to main.js with gathered defconfigs.
	 *
	 * This API called from Modal OK button handler.
	 */

	handleOk(callback) {
		let selected = [];
		let list = document.getElementById("selected-defconfig-list");

		for (let e of list.childNodes) {
			selected.push(e.dataset.exactName);
		}

		// T.B.D: Do we need sort to selected defconfigs?
		callback("ok", selected.join('\n'));
	}
}

function showDefconfigSelection(deflist, callback) {
	if (!document.body.dataset.mode) {
		let modal = new Modal(DefconfigDialogContent, deflist, callback);
		modal.show();
	}
	else if (document.body.dataset.mode === "Kernel") {
		showKernelDefconfigSelection(deflist, callback);
	}
	else {
		showSdkDefconfigSelection(deflist, callback);
	}
}

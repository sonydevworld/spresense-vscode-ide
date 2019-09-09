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
	var modal = document.getElementById("defconfig")
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
	}

	for (let c of deflist) {
		var e = document.createElement("div");
		c = c.replace("-defconfig", "")
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

	var device_button = document.getElementById("category-device");
	var feature_button = document.getElementById("category-feature");
	var examples_button = document.getElementById("category-examples");

	// Select device tab as default.
	device_button.classList.add("active");
	feature_button.classList.remove("active");
	examples_button.classList.remove("active");

	let handle_tab = (event) => {
		let tabs = [
			{ button: device_button, content: device },
			{ button: feature_button, content: feature },
			{ button: examples_button, content: examples },
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

	device_button.addEventListener("click", handle_tab);
	feature_button.addEventListener("click", handle_tab);
	examples_button.addEventListener("click", handle_tab);

	let ok_button = document.getElementById("defconfig-ok");
	let cancel_button = document.getElementById("defconfig-cancel");

	let removeEventListeners = () => {
		ok_button.removeEventListener("click", handle_ok);
		cancel_button.removeEventListener("click", handle_cancel);
		device_button.removeEventListener("click", handle_tab);
		feature_button.removeEventListener("click", handle_tab);
		examples_button.removeEventListener("click", handle_tab);
	};

	let clearLists = () => {
		while (list.lastChild) {
			list.removeChild(list.lastChild);
		}
		while (slist.lastChild) {
			slist.removeChild(slist.lastChild);
		}
	};

	let handle_ok = (event) => {
		modal.style.display = "none";

		let selected = [];

		for (var e of slist.childNodes) {
			selected.push(e.innerHTML);
		}

		removeEventListeners();
		clearLists();

		callback("ok", selected.join('\n'));
	};

	let handle_cancel = (event) => {
		modal.style.display = "none";

		removeEventListeners();
		clearLists();

		callback("cancel", undefined);
	};

	ok_button.addEventListener("click", handle_ok);
	cancel_button.addEventListener("click", handle_cancel);

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
	var modal = document.getElementById("defconfig")
	var list = document.getElementById("defconfig-kernel");

	let onselected = (event) => {
		for (let e of event.target.parentNode.childNodes) {
			if (e === event.target) {
				e.classList.add("active");
			} else {
				e.classList.remove("active");
			}
		}
	}

	for (let c of deflist) {
		var e = document.createElement("div");
		c = c.replace("-defconfig", "")
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

	let ok_button = document.getElementById("defconfig-ok");
	let cancel_button = document.getElementById("defconfig-cancel");

	let removeEventListeners = () => {
		ok_button.removeEventListener("click", handle_ok);
		cancel_button.removeEventListener("click", handle_cancel);
	};

	let clearLists = () => {
		while (list.lastChild) {
			list.removeChild(list.lastChild);
		}
	};

	let handle_ok = (event) => {
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

	let handle_cancel = (event) => {
		modal.style.display = "none";

		removeEventListeners();
		clearLists();

		callback("cancel", undefined);
	};

	ok_button.addEventListener("click", handle_ok);
	cancel_button.addEventListener("click", handle_cancel);

	modal.querySelectorAll("#defconfig-selector, #defconfig-selected").forEach((v, k, p) => {
		v.classList.add("hide");
	});

	modal.style.display = "block";
}

function showDefconfigSelection(deflist, callback, mode) {
	if (document.body.dataset.mode === "Kernel") {
		showKernelDefconfigSelection(deflist, callback);
	} else {
		showSdkDefconfigSelection(deflist, callback);
	}
}

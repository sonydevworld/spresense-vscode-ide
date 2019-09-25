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

const DISPLAYLEVEL = 0;

const MENU = 31;
const COMMENT = 6;
const BOOL = 3;
const HEX = 24;
const INT = 27
const STRING = 47;
const TRISTATE = 48;
const CHOICE = 4;

const DEFAULT_HELP = "There is no help available for this option.";

// Convert number to tristate strings

const YMN = {0: "n", 1: "m", 2: "y"};

// To use dependency calculation
const y = true;
const n = false;

// Set class "inactive" or "invisible", it is for view mode of
// non active options.
var inactive;

// Communicate with VS Code
const vscode = acquireVsCodeApi();

var optiondb;

// Hold a status of building widget class tree. If it is true,
// no propagation is running caused by value changes.

var underConstruction;

/**
 * Internal mini database for widget management.
 * This class almost the same with Object class but it can be
 * store multiple keys.
 */

class OptionDatabase {
	constructor () {
		this.db = {};
	}

	set(symbol, obj){
		if (!this.db[symbol]) {
			this.db[symbol] = obj;
		} else if (this.db[symbol] instanceof Array) {
			this.db[symbol].push(obj);
		} else {
			let first = this.db[symbol];
			this.db[symbol] = [first, obj];
		}
	}

	get(symbol) {
        if (this.db[symbol]) {
            if (this.db[symbol] instanceof Array) {
                return this.db[symbol][0];
            } else {
                return this.db[symbol];
            }
        }
        return null;
	}

    *[Symbol.iterator]() {
        for (let obj of Object.values(this.db)) {
            if (obj instanceof Array) {
                for (let co of obj) {
                    yield co;
                }
            } else {
                yield obj;
            }
        }
    }
}

class BaseWidget {

	constructor(node) {
		var row;

		this._node = node;
		this._active = true;
		this._referenced = []; // Holds symbol list to refer
		this._referrers = []; // Holds object list to referrers
		this._selects = []; // Holds select element list
		this.classDefault = ""; // Class default value

		// Flag for prevent multiple entering to depend(). This member
		// is only useful for ChoiceWidget;
		this._dependDone = false;

		// Create widget container
		this._element = document.createElement("div");
		if (node.name) {
			this._element.id = node.name;
		}
		this._element.classList.add("widget");

		// 1st row: hierarchy text
		row = document.createElement("p");
		row.className = "hierarchy";
		row.innerHTML = node.hierarchy;
		this._element.appendChild(row);

		// 2nd row: config prompt and inputs (checkbox, string, etc...)
		row = document.createElement("div");

		// Now only create element for prompt
		// input element would be added at subclasses.
		var _prompt = document.createElement("h3");
		_prompt.className = "prompt";
		_prompt.innerHTML = node.prompt;
		row.appendChild(_prompt);
		this._element.appendChild(row);

		// No prompted option never shown in the UI.
		if (!node.prompt) {
			this._element.classList.add("no-prompt");
		}

		// 3rd row: config symbol
		row = document.createElement("div");
		row.className = "config-and-input";
		if (node.name) {
			var _name = document.createElement("p");
			_name.innerHTML = node.name;
			_name.className = "config-symbol";
			row.appendChild(_name);
		}
		this._element.appendChild(row);

		// 4th row: help
		row = document.createElement("p");
		row.className = "config-help";
		if (node.help) {
			row.innerHTML = node.help.replace(/\n/g, "<br>");
		} else {
			row.innerHTML = DEFAULT_HELP;
		}
		this._element.appendChild(row);

		// 5th row: dependency
		row = document.createElement("div");
		if (node.cond && node.cond != "y") {
			var _cond = document.createElement("p");
			_cond.innerHTML = "Depends on: " + node.cond;
			_cond.className = "config-cond";
			row.appendChild(_cond);
		}
		if (node.selects) {
			for (var s of node.selects) {
				var e = document.createElement("p");
				e.innerHTML = "Selects: " + s.symbol;
				if (s.cond && s.cond != "y") {
					e.innerHTML += " if " + s.cond;
				}
				row.appendChild(e);
			}
		}

		// Add dependency div tag only if existed. This is for reducing
		// a number of tags.

		if (row.innerHTML.length > 0) {
			this._element.appendChild(row);
		}

		this.value = node.value;
		this.user_value = node.user_value || undefined;
	}

	/**
	 * Add input element (checkbox, text and select) into widget
	 *
	 * @param {HTMLElement} _input
	 */

	addInputField(_input) {
		var elem = this._element.getElementsByClassName("config-and-input")[0];
		var child = elem.getElementsByClassName("config-symbol");
		if (child.length > 0) {
			elem.insertBefore(_input, child[0]);
		} else {
			elem.appendChild(_input);
		}
	}

	depend() {
		// Guard to multiple depend for ChoiceWidget, it will be called
		// from children.

		if (this._dependDone) {
			return;
		}

		this._condIntoList(this._node.cond);

		if (this._node.defaults) {
			for (var d of this._node.defaults) {
				this._condIntoList(d.cond);
			}
		}

		if (this._node.ranges) {
			for (var r of this._node.ranges) {
				this._condIntoList(r.cond);
			}
		}

		for (var n of this._referenced) {
			var opt = optiondb.get(n);
			if (opt) {
				opt.registerAdd(this);
			}
		}

		if (this._node.selects) {
			for (var s of this._node.selects) {
				var opt = optiondb.get(s.symbol);
				if (opt) {
					this._selects.push(opt);
				}
			}
		}

		// Add weak reverse refereces (imply) into select list.
		// The operation for implies are the same with selects ones,
		// send "evaluate" command, so set into the same list.

		if (this._node.implies) {
			for (var i of this._node.implies) {
				var opt = optiondb.get(s.symbol);
				if (opt) {
					this._selects.push(opt);
				}
			}
		}

		this._dependDone = true;
	}

	_condIntoList(cond) {
		if (!cond) {
			return;
		}

		cond.match(/[\w]+/g).forEach((value, _index, _array) => {
			if (/([ymn]|^[\d]+$)/.test(value)) {
				 return;
			}

			if (!this._referenced.includes(value)) {
				this._referenced.push(value);
			}
		});
	}

	registerAdd(obj) {
		this._referrers.push(obj);
	}

	isSelected() {
		return this._node.rev_dep && evaluateStr(this._node.rev_dep);
	}

	evaluate() {
		let active = true;

		if (this._node.cond) {
			active = evaluateStr(this._node.cond);
		}

		if (active) {
			this.handle_active();
		} else {
			this.handle_deactive();
		}
	}

	setViewActive(active) {
		this._active = active;
		if (active) {
			this._element.classList.remove(inactive);
			this.activated();
		} else {
			this._element.classList.add(inactive);
			this.deactivated();
		}
	}

	handle_active() {
		let val;

		if (this._active) {
			// Use current value if already active
			val = self.value;
		} else {
			// Use user configured value if no selected and no implied.
			// If user_value is undefined, then fall into default value.
			val = this.user_value;
		}

		if (this.isSelected()) {
			// 'select'ed symbol is boolean option, so we set "y" constantly.
			val = "y";
		}

		// Evaluate 'imply' keyword dependency
		if (this._node.weak_rev_dep) {
			val = evaluateStr(this._node.weak_rev_dep) ? "y" : "n";
		}

		// Call propagate when value is not changed and this object status
		// is changing.

		if (!this.set_value(val) && !this._active) {
			this.propagate();
		}

		this.setViewActive(true);
	}

	handle_deactive() {
		this.setViewActive(false);
	}

	// All of subclasses must have activated and deactivated method.
	// These functions would be called from evaluate(), and they must be
	// control the visibility of input tag they have.

	activated() {
		this._input.value = this.value;
		this._input.removeAttribute("disabled");
	}

	deactivated() {
		this._input.value = "";
		this._input.setAttribute("disabled", "disabled");
	}

	/**
	 * Get default value from defaults list.
	 * If option node does not have defaults list, return classDefault
	 * property.
	 * classDefault is empty string, but some subclasses overwrites it by
	 * specific default value.
	 */

	getDefault() {
		if (this._node.defaults) {
			for (let def of this._node.defaults) {
				if (evaluateStr(def.cond)) {
					return def.default;
				}
			}
		}
		return this.classDefault;
	}

	/**
	 * Set specified value to option
	 *
	 * @param {string} x The value will be set. If undefeind, leave it to default.
	 */

	set_value(x) {
		if (x === undefined) {
			x = this.getDefault();
		}

		this.user_value = x;

		if (this.value !== x) {
			this.value = this._input.value = x;
			this.propagate();
			return true;
		}

		return false;
	}

	unset_value() {
		this.user_value = undefined;
	}

	propagate() {
		// Don't propagate while widgets under construction
		if (underConstruction) {
			return;
		}

		for (var node of this._referrers) {
			node.evaluate();
		}
		for (var node of this._selects) {
			node.evaluate();
		}
	}

	/**
	 * Set initial state from precalculated dependency.
	 */

	setInitialState() {
		this.setViewActive(this._node.dep === "y");
	}

	get element() {
		return this._element;
	}

	/**
	 * Setter method to option value
	 *
	 * Do not call this function from outside of classes, call
	 * set_value() instead.
	 *
	 * @param {string} x
	 */

	set value(x) {
		this._element.dataset.configured = x; // remain for debug
		this._value = x;
	}

	get value() {
		return this._value;
	}

	get name() {
		return this._node.name;
	}

	get active() {
		return this._active;
	}
}

class BoolWidget extends BaseWidget {
	constructor(node) {
		super(node);

		this.user_value = YMN[node.user_value];
		this.classDefault = "n";

		this._element.classList.add("boolean");
		this._input = document.createElement("input");
		this._input.type = "checkbox";
		this._input.checked = this.value === "y";
		this.addInputField(this._input);

		this._input.addEventListener("change", (event) => {
			this.value = event.target.checked ? "y" : "n";
			if (this.isSelected()) {
				this.value = "y";
				event.target.checked = true;
			}
			this.user_value = this.value;
			this.propagate();
		});

		this.setInitialState();
	}

	activated() {
		this._input.checked = this.value === "y";
		this._input.removeAttribute("disabled");
	}

	deactivated() {
		this._input.checked = false;
		this._input.setAttribute("disabled", "disabled");
	}

	set_value(x) {
		if (x === undefined) {
			x = this.getDefault();
		}
		if (this.isSelected()) {
			x = "y";
		}

		this.user_value = x;
		if (this.value !== x) {
			this.value = x;
			this._input.checked = x === "y";
			this.propagate();
			return true;
		}

		return false;
	}
}

class HexWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this.classDefault = "0x0";

		this._element.classList.add("hex");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this.addInputField(this._input);

		this._input.addEventListener("keyup", (event) => {
			var _pat = /^0x[0-9a-fA-F]+$/;
			var m = _pat.test(event.target.value);

			if (event.target.value.length == 0 || m) {
				event.target.style.backgroundColor = "";
			} else {
				event.target.style.backgroundColor = "rgb(255, 153, 153)";
			}
		});

		this._input.addEventListener("change", (event) => {
			this.value = this.user_value = event.target.value;
			this.propagate();
		});

		this.setInitialState();
	}
}

class IntWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this.classDefault = "0";

		this._element.classList.add("int");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this._input.value = this.value;
		this.addInputField(this._input);

		this._input.addEventListener("keyup", (event) => {
			this.checkRange();
		});

		this._input.addEventListener("change", () => {
			this.value = this.user_value = event.target.value;
			this.propagate();
		});

		this.setInitialState();
	}

	evaluate() {
		super.evaluate();

		if (this._active) {
			this.checkRange();
		}
	}

	checkRange() {
		if (this._node.ranges && this._input.value.length) {
			if (this.between(this._input.value)) {
				this._input.style.backgroundColor = "";
			} else {
				this._input.style.backgroundColor = "rgb(255, 153, 153)";
			}
		}
	}

	between(num) {
		var valid = /(0$|^[1-9][0-9]*$)/.test(num);
		if (!valid) {
			return false;
		}

		num = Number(num);

		for (let r of this._node.ranges) {
			if (evaluateStr(r.cond)) {
				if (num >= Number(r.min) && num <= Number(r.max)) {
					return true;
				}
			}
		}

		return false;
	}
}

/*
 * Tristate is not supported because of kconfiglib.py.
 */
class TristateWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._element.classList.add("tristate");
		var _input = document.createElement("select");
		var _y = document.createElement("option");
		var _n = document.createElement("option");
		var _m = document.createElement("option");
		_y.value = "y";
		_y.innerText = "Yes";
		_n.value = "n";
		_n.innerHTML = "No";
		_m.value = "m"
		_m.innerHTML = "Module";

		_input.appendChild(_y);
		_input.appendChild(_n);
		_input.appendChild(_m);
		this.addInputField(_input);
	}
}

class StringWidget extends BaseWidget {
	constructor(node) {
		super(node);

		this._element.classList.add("string");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this._input.value = node.value;
		this.addInputField(this._input);

		this._input.addEventListener("change", () => {
			this.value = this.user_value = this._input.value;
			this.propagate();
		});

		this.setInitialState();
	}
}

class ChoiceWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._element.classList.add("choice");
		this._options = [];
		this._input = document.createElement("select");

		this.createSelectInputField();
		this.addInputField(this._input);

		this.classDefault = this._input.options[0].id;

		this._input.addEventListener("change", (event) => {
			for (let opt of this._options) {
				opt.select(opt.name === event.target.selectedOptions[0].id ? "y" : "n");
			}
			this.user_value = event.target.selectedOptions[0].id;
		});

		this.setInitialState();
	}

	createSelectInputField() {
		let selected = undefined;
		for (let n of this._node.children) {
			let opt = new ChoiceOption(this, n);
			this._options.push(opt);
			this._input.add(opt.element);
			if (n.value === "y") {
				selected = opt.name;
			}

			// Add choice option to database
			optiondb.set(opt.name, opt);
		}

		// Finally, actually select, make sure that 'selected' is exists but
		// it always chosen. If it is not, the helper script mistakes.

		this.set_value(selected);
	}

	/**
	 * Override super class method because choice default value is name property.
	 */

	getDefault() {
		if (this._node.defaults) {
			for (let def of this._node.defaults) {
				if (evaluateStr(def.cond)) {
					return def.name;
				}
			}
		}
		return this.classDefault;
	}

	/**
	 * Common interface but not called from other widgets,
	 * it called from children and internal.
	 *
	 * @param {string} val Option symbol name
	 */

	set_value(val) {
		if (!val) {
			val = this.getDefault();
		}

		for (let opt of this._options) {
			opt.select(opt.name === val ? "y" : "n");
		}
		this.user_value = val;
	}

	activated() {
		this._input.removeAttribute("disabled");

		for (let opt of this._options) {
			opt._active = true;
		}
	}

	deactivated() {
		this._input.setAttribute("disabled", "disabled");

		for (let opt of this._options) {
			opt._active = false;
			opt.value = undefined;
		}
	}
}

class ChoiceOption extends BaseWidget {
	constructor(parent, node) {
		super(node);

		this._parent = parent;

		// Replace element
		this._element = document.createElement("option");
		this._element.id = node.name;
		this._element.innerHTML = node.prompt;

		this.value = node.value;
		this.user_value = YMN[node.user_value];
	}

	/**
	 * Set value to this option.
	 *
	 * @param {string} val "y" or "n"
	 */

	set_value(val) {
		if (val === "y") {
			this._parent.set_value(this.name);
		}
	}

	// Each choice option has no defaults, so pass to parent methods
	// about default related process.

	depend() {
		super.depend();
		this._parent.depend();
	}

	evaluate() {
		this._parent.evaluate();
	}

	handle_active() {
		this._parent.handle_active();
	}

	handle_deactive() {
		this._parent.handle_deactive();
	}

	activated(def) {
		this._parent.activated(def);
	}

	deactivated(def) {
		this._parent.deactivated(def);
	}

	/**
	 * Select this option, this method will be called by ChoiceWidget
	 *
	 * @param {boolean} val
	 */

	select(val) {
		this._element.selected = val === "y";

		this.user_value = val;
		if (this.value !== val) {
			this.value = val;
			this.propagate();
		}
	}
}

function promptToId(str) {
	return str.toLowerCase().replace(/\s/g, "-");;
}

function createCommentWidget(node) {
	var e = document.createElement("p");
	e.className = "comment";
	e.innerHTML = node.prompt;
	return e;
}

function widgetFactory(node) {
	var widget;

	if (node.type == COMMENT) {
		return null; // Ignore comments
	}
	else if (node.type == BOOL) {
		widget = new BoolWidget(node);
	}
	else if (node.type == HEX) {
		widget = new HexWidget(node);
	}
	else if (node.type == INT) {
		widget = new IntWidget(node);
	}
	else if (node.type == TRISTATE) {
		// May not comes here because kconfiglib.py is not supported to
		// treat tristate. They treated as a boolean.
		widget = new TristateWidget(node);
	}
	else if (node.type == STRING) {
		widget = new StringWidget(node);
	}
	else if (node.type == CHOICE) {
		widget = new ChoiceWidget(node);
	}
	else {
		console.log("ignore type " + node.type);
		return null; // may not comes here
	}

	// Add created widget to database except Choice widget,
	// because it is special widget, actual configuration symbols are
	// ChoiceOption, and they were added at ChoiceWidget constructor.

	if (node.type != CHOICE) {
		optiondb.set(widget.name, widget);
	}

	return widget.element;
}

function layoutConfigs(parent, list, hierarchy) {

	for (let n of list) {
		var elem;

		n.hierarchy = hierarchy;
		if (n.type != MENU) {
			var widget = widgetFactory(n);
			if (widget) {
				parent.appendChild(widget);
				elem = widget;
			}
		} else {
			// Only first level menu nodes.
			elem = document.createElement("div");
			if (hierarchy.length === 0) {
				var menu = document.createElement("h2");
				menu.id = promptToId(n.prompt);
				menu.className = "menu-title";
				menu.innerHTML = n.prompt;
				elem.appendChild(menu);
			}
			parent.appendChild(elem);
		}

		if (n.children && n.type != CHOICE) {
			var h;
			if (hierarchy.length == 0) {
				h = n.prompt;
			} else {
				h = hierarchy + " &#10148; " + n.prompt;
			}

			console.assert(elem, `${n}`);

			// node-child div is just a container for cancelling filter.

			var container = document.createElement("div");
			container.className = "node-child";
			container.dataset.prompt = n.prompt;
			container.appendChild(elem);
			parent.appendChild(container);

			layoutConfigs(container, n.children, h);
		}
	}
}

function createSubMenuItem(node) {
	var m = document.createElement("li");
	var a = document.createElement("a");
	a.innerHTML = node.prompt;
	a.href = "#" + promptToId(node.prompt);
	m.appendChild(a);
	return m;
}

function createSubmenu(list) {
	var submenu = document.createElement("ul");

	// List only first level menus at sub menu.
	for (let n of list) {
		if (n.type == MENU || n.menuconfig == true) {
			submenu.appendChild(createSubMenuItem(n));
		}
	}

	return submenu;
}

function getConfiguredValue(name) {
	let opt = optiondb.get(name);
	if (opt) {
		if (!opt.value || opt.value === "") {
			return "n";
		} else {
			return opt.value;
		}
	} else {
		return "n";
	}
}

function evaluateStr(s) {
	let _s = s;
	let m = s.match(/[\w]+/g);

	// console.log(`${s} => ${evalstr}`);
	for (let value of m) {
		if (!/([ymn]|^[\d]+$)/.test(value)) {
			var v = getConfiguredValue(value);
			if (!v) {
				return false;
			}
			_s = _s.replace(value, v);
		}
	}

	// Replace equal comparison to JavaScript style.
	_s = _s.replace(/[!<>]?=/g, (x) => {
		return x === "=" ? "===" : x;
	});

	return eval(_s);
}

function constructTree(data) {
	var category = document.getElementById("category");
	var configs = document.getElementById("configs");

	optiondb = new OptionDatabase();

	if (!data.children) {
		return;
	}

	category.appendChild(createSubmenu(data.children));

	underConstruction = true;
	layoutConfigs(configs, data.children, "");
	underConstruction = false;

	vscode.postMessage({command: "loading", content: 50});

	for (let opt of optiondb) {
		opt.depend();
	}

	vscode.postMessage({command: "loading", content: 100});
}

function filterConfigs() {
	var input = document.getElementById("search-box");
	var filter = input.value.toLowerCase();
	var widgets = document.getElementsByClassName("widget");

	for (var w of widgets) {
		var prompt = w.getElementsByTagName("h3")[0];
		if (prompt == undefined) continue;
		var txt = prompt.textContent || prompt.innerText;
		var h = w.getElementsByClassName("hierarchy")[0];
		txt += " " + h.textContent || h.innerText;
		txt += " " + w.id;
		if (txt.toLowerCase().indexOf(filter) > -1) {
			w.style.display = "";
		} else {
			w.style.display = "none";
		}
	}
}

function generateConfigFileContent() {
	var buf = [];

	for (let opt of optiondb) {
		if (!opt.active) {
			continue;
		}

		let config;

		if (opt instanceof StringWidget) {
			config = `CONFIG_${opt.name}="${opt.value}"`;
		} else if (opt instanceof BoolWidget || opt instanceof ChoiceOption) {
			if (opt.value === "y" || opt.value === "2") {
				config = `CONFIG_${opt.name}=y`;
			} else {
				config = `# CONFIG_${opt.name} is not set`;
			}
		} else {
			// boolean, int and hex values
			config = `CONFIG_${opt.name}=${opt.value}`
		}

		console.log(config);
		buf.push(config);
	}

	return buf.join("\n");
}

/**
 * Parse .config line
 *
 * @param {string} line Line text of .config file
 */

function parseConfig(line) {
	let m;
	if ((m = line.match(/^CONFIG_(?<symbol>.*)=(?<value>.*)/))) {
		return [m.groups.symbol, m.groups.value];
	} else if ((m = line.match(/^# CONFIG_(?<symbol>\w*) is not set/))) {
		return [m.groups.symbol, "n"];
	}
	return undefined;
}

/**
 * Load .config style configurations
 *
 * This function parses and applies options from .config style file.
 * The options not contained in .config is fall into default value.
 *
 * @param {string} buf .config file content
 */

function loadConfig(buf) {
	// Reset user specified values
	for (let opt of optiondb) {
		opt.unset_value();
	}

	let enablement = {};
	for (let line of buf.split("\n")) {
		let config = parseConfig(line);
		if (config) {
			enablement[config[0]] = config[1];
		}
	}

	for (let opt of optiondb) {
		let val = enablement[opt.name];
		if (val && opt instanceof StringWidget) {
			// Peek string value and check it is welformed.
			let m = val.match(/"((?:[^"]|.)*)"/);
			if (!m) {
				console.warn(`Found malformed string value. Ignored. ${m[0]}`);
				continue;
			}
			// Unescape
			val = m[1].replace(/\\(.)/g, "$1");
		}
		opt.set_value(val);
	}
}

function main() {

	if (document.body.dataset.mode === "Kernel") {
		inactive = "invisible";
	} else {
		inactive = "inactive";
	}

	document.getElementById("search-box").addEventListener("keyup", filterConfigs);
	document.getElementById("search-box").addEventListener("search", filterConfigs);

	document.getElementById("new").addEventListener("click", event => {
		vscode.postMessage({command: "get-defconfigs"});
	});

	document.getElementById("save").addEventListener("click", event => {
		// Send message with generated .config content to extension main,
		// and save it because webview javascript can't save it directly.

		vscode.postMessage({command: "save", content: generateConfigFileContent()});
	});

	document.getElementById("saveas").addEventListener("click", event => {
		vscode.postMessage({command: "saveas", content: generateConfigFileContent()});
	});

	document.getElementById("load").addEventListener("click", event => {
		vscode.postMessage({command: "load"});
	});

	// Message handling from extension.ts
	window.addEventListener('message', event => {
		const message = event.data;
		console.log(`command: ${message.command}`);
		switch (message.command) {
			case "init":
				if (message.content) {
					let data = JSON.parse(message.content);
					constructTree(data);
					hideProgress();
				}
				break;

			case "loaded":
				if (message.content) {
					loadConfig(message.content);
				}
				break;

			case "get-defconfigs":
				// A return of get-defconfigs command.
				if (message.content) {
					showDefconfigSelection(message.content, (status, data) => {
						if (status === "ok") {
							vscode.postMessage({command: "load-defconfigs", content: data});
						}
					});
				}
				break;

			case "load-defconfigs":
				loadConfig(message.content);
				break;
		}
	});
}
main();

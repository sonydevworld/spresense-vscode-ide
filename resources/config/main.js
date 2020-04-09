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
const m = true;
const n = false;

// Set class "inactive" or "invisible", it is for view mode of
// non active options.
var inactive;

// Communicate with VS Code
const vscode = acquireVsCodeApi();

// Object databases
var optiondb;
var menuList;
var commentList;
var tristateList;

// Hold a status of building widget class tree. If it is true,
// no propagation is running caused by value changes.

var underConstruction;

// menu_id is for set ID to menu checkbox
var menu_id;

// The choice option has not the actual symbol, so we need to
// assign the ID for scroll to them.
var choice_id;

// modules option, it would be BoolWidget actually.
// the Modules option will be affected to tristate options.
var MODULES;

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

		this._node = node;
		this._active = true;
		this._referenced = []; // Holds symbol list to refer
		this._referrers = []; // Holds object list to referrers
		this._selects = []; // Holds select element list
		this.classDefault = ""; // Class default value

		// Flag for prevent multiple entering to depend(). This member
		// is only useful for ChoiceWidget;
		this._dependDone = false;

		// Create base div tag with config class.
		this._element = document.createElement("div");
		this._element.classList.add("config");

		if (node.prompt) {
			let e = document.createElement("div");
			e.className = "prompt";
			e.innerHTML = node.prompt;
			e.addEventListener("click", event => {
				let help = document.getElementById("help");
				if (node["help"] != null) {
					help.innerHTML = node.help.replace(/\n/g,"<br>");
				} else {
					help.innerHTML = DEFAULT_HELP;
				}
			});
			this._element.appendChild(e);
		} else {
			this._element.classList.add("no-prompt");
		}

		if (node["name"] != null) {
			let e = document.createElement("div");
			e.className = "symbol";
			e.innerHTML = node.name;
			this._element.appendChild(e);
			this._element.id = node.name;
		}

		if (node["value"] != null) {
			this.value = node.value;
			this.user_value = node.user_value || undefined;
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

// FIXME: bool type option can be used in <expr> style,
// So we need to process them except 'ymn' values.

class BoolWidget extends BaseWidget {
	constructor(node) {
		super(node);

		this.user_value = YMN[node.user_value];
		this.classDefault = "n";
		this.modules = node["modules"] != null ? true : false;

		this._body = this._element;
		if (node["menuconfig"] != null && node.menuconfig) {
			// Replace responsive element to menu container

			this.transformMenuConfig();
		}

		let label = document.createElement("label");
		label.className = "bool";
		this._body.appendChild(label);

		this._input = document.createElement("input");
		this._input.type = "checkbox";
		this._input.checked = this.value === "y";

		this._input.addEventListener("change", (event) => {
			this.value = event.target.checked ? "y" : "n";
			if (this.isSelected()) {
				this.value = "y";
				event.target.checked = true;
			}
			this.user_value = this.value;
			this.propagate();
			if (MODULES === this) {
				invalidateTristate();
			}
		});

		let slider = document.createElement("span");
		slider.className = "slider";

		label.append(this._input, slider);

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
			if (MODULES === this) {
				invalidateTristate();
			}
			return true;
		}

		return false;
	}

	transformMenuConfig() {
		this._element = document.createElement("div");
		this._element.classList.add("menu-container");

		let id = "menu-" + menu_id++;
		let input = document.createElement("input");
		let label = document.createElement("label");
		let prompt = document.createElement("div");
		let symbol = document.createElement("div");
		input.type = "checkbox";
		input.id = id;
		label.classList.add("menu", "config");
		label.setAttribute("for", id);

		prompt.innerHTML = this._node.prompt;
		prompt.className = "prompt";
		symbol.innerHTML = this._node.name;
		symbol.className = "symbol";
		label.id = this._node.name;
		label.append(prompt, symbol);
		// Switch control box to label
		this._body = label;

		// Create menuitems property to hold configs under this menu.
		this.menuitems = document.createElement("div");
		this.menuitems.className = "menuitems";

		this._element.append(input, label, this.menuitems);
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
		this._element.appendChild(this._input);

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
		this._element.appendChild(this._input);

		this._input.addEventListener("keyup", (event) => {
			this.checkRange();
		});

		this._input.addEventListener("change", (event) => {
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

class TristateWidget extends BaseWidget {
	constructor(node) {
		super(node);

		this.classDefault = "n";
		this.user_value = YMN[node.user_value];

		this._tristate = document.createElement("div");
		let _n = document.createElement("div");
		let _m = document.createElement("div");
		let _y = document.createElement("div");

		_n.innerHTML = "N";
		_m.innerHTML = "M";
		_y.innerHTML = "Y";

		this._tristate.append(_n, _m, _y);
		this._tristate.className = "tristate";
		this._tristate.dataset.value = this.value;
		this._tristate.addEventListener("click", (event) => {
			this.tristate_next();
		});
		this._element.append(this._tristate);

		this._m = _m;
		this.setInitialState();
	}

	activated() {
		this._tristate.classList.remove("disabled");
	}

	deactivated() {
		this._tristate.classList.add("disabled");
	}

	set_value(x) {
		if (x === undefined) {
			x = this.getDefault();
		}

		this.user_value = x;
		if (this.value !== x) {
			this.value = x;
			this._tristate.dataset.value = this.value;
			this.propagate();
			return true;
		}

		return false;
	}

	tristate_next() {
		if (this._tristate.classList.contains("disabled")) {
			return;
		}

		switch (this.value) {
			case "n":
				if (MODULES.value == "y") {
					this.value = 'm';
				} else {
					this.value = 'y';
				}
				break;
			case "m":
				this.value = 'y';
				break;
			case "y":
				this.value = 'n';
				break;
		}
		this._tristate.dataset.value = this.user_value = this.value;
		this.propagate();
	}

	// Special method to reflect MODULES option changes.
	// user_value member is not changed in here because it holds user
	// selected data, and it will be restored by MODULES enabled again.

	modulesChange(enable) {
		if (enable) {
			this._m.innerHTML = "M";
			this._tristate.dataset.value = this.value = this.user_value;
		} else {
			this._m.innerHTML = "-";
			if (this.value == 'm') {
				this._tristate.dataset.value = this.value = 'y';
			}
		}
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
		this._element.appendChild(this._input);

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
		this._element.id = "choice-" + choice_id++;
		this._options = [];
		this._input = document.createElement("select");

		this.createSelectInputField();
		this._element.appendChild(this._input);

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

class MenuWidget extends BaseWidget {
	constructor (node) {
		super(node);

		// Add special menu container for create new menu structure
		// to use expandable menu.
		this._element = document.createElement("div");
		this._element.classList.add("menu-container");

		let id = "menu-" + menu_id++;
		let input = document.createElement("input");
		let label = document.createElement("label");
		let prompt = document.createElement("div");
		input.type = "checkbox";
		input.id = id;
		label.classList.add("menu", "config");
		label.setAttribute("for", id);
		label.id = id + "-label";
		prompt.innerHTML = node.prompt;
		prompt.classList.add("prompt");
		label.appendChild(prompt);

		this.menuitems = document.createElement("div");
		this.menuitems.className = "menuitems";

		this._element.append(input, label, this.menuitems);

		this.setInitialState();
	}

	activated() {
		// do nothing
	}
	deactivated() {
		// do nothing
	}
	set_value() {
		return true;
	}
}

class CommentWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._element.classList.add("comment");

		this.setInitialState();
	}

	activated() {
		// do nothing
	}
	deactivated() {
		// do nothing
	}
	set_value() {
		return true;
	}
}

function promptToId(str) {
	return str.toLowerCase().replace(/\s/g, "-");;
}

function widgetFactory(node) {
	var widget;

	switch (node.type) {
		case COMMENT:
			widget = new CommentWidget(node);
			commentList.push(widget);
			break;

		case MENU:
			widget = new MenuWidget(node);
			menuList.push(widget);
			break;

		case BOOL:
			widget = new BoolWidget(node);
			if (widget.modules) {
				console.log("MODULE option is " + widget.name);
				MODULES = widget;
			}
			optiondb.set(widget.name, widget);
			break;

		case HEX:
			widget = new HexWidget(node);
			optiondb.set(widget.name, widget);
			break;

		case INT:
			widget = new IntWidget(node);
			optiondb.set(widget.name, widget);
			break;

		case TRISTATE:
			widget = new TristateWidget(node);
			optiondb.set(widget.name, widget);
			tristateList.push(widget);
			break;

		case STRING:
			widget = new StringWidget(node);
			optiondb.set(widget.name, widget);
			break;

		case CHOICE:
			widget = new ChoiceWidget(node);
			break;

		default:
			console.log("ignore type " + node.type);
			return null; // may not comes here
	}

	return widget;
}

function layoutConfigs(parent, list) {

	for (let n of list) {
		let widget = widgetFactory(n);
		if (widget) {
			parent.appendChild(widget.element);

			if (n.children && !(widget instanceof ChoiceWidget)) {

				if (widget["menuitems"] != null) {
					layoutConfigs(widget.menuitems, n.children);
				} else {
					// Add children to the same lavel of this widget, it
					// may be bool option.
					layoutConfigs(parent, n.children);
				}
			}
		}
	}
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

function invalidateTristate() {
	if (MODULES != null) {
		for (let t of tristateList) {
			t.modulesChange(MODULES.value == "y");
		}
	}
}

function constructTree(data) {
	var configs = document.getElementById("configs");

	// Initialize globals
	optiondb = new OptionDatabase();
	menuList = [];
	commentList = [];
	tristateList = [];
	MODULES = null;

	if (!data.children) {
		return;
	}

	menu_id = 0;
	choice_id = 0;

	underConstruction = true;
	layoutConfigs(configs, data.children);
	underConstruction = false;

	vscode.postMessage({command: "loading", content: 50});

	for (let opt of optiondb) {
		opt.depend();
	}
	for (let m of menuList) {
		m.depend();
	}
	for (let c of commentList) {
		c.depend();
	}

	// Invalidate tristate widgets by MODULES option
	invalidateTristate();

	vscode.postMessage({command: "loading", content: 100});
}

function expandConfig(node) {
	if (node.parentNode.classList.contains("contents")) {
		// Break when reached to root node of config contents
		return;
	}

	// Menu trees are constructed with .menu-container > .menuitem > .config,
	// and menu expand/collapse with hidden checkbox in .menu-container.

	let parent = node.parentNode.parentNode;
	let input = parent.querySelector("input");
	input.checked = true;

	expandConfig(parent);
}

function jumpToConfig(event) {
	// Delegate events from child
	let sym;
	if (event.target.className === "item") {
		sym = event.target.dataset.symbol;
	} else {
		sym = event.target.parentNode.dataset.symbol;
	}

	let opt = document.getElementById(sym);
	if (opt) {
		if (opt.tagName === "LABEL") {
			if (!opt.parentNode.parentNode.classList.contains("contents")) {
				expandConfig(opt.parentNode);
			}
		} else {
			expandConfig(opt);
		}
		opt.scrollIntoView();
	} else {
		console.log("No symbols for " + event.target.textContent);
	}
}

function createResultItem(config, prompt) {
	let item = document.createElement("div");

	item.className = "item";
	item.appendChild(prompt.cloneNode(true));
	item.addEventListener("click", jumpToConfig);
	item.dataset.symbol = config.id;

	if (!config.id.match(/^choice-\d+/) && config.tagName !== "LABEL") {
		const sym = document.createElement("div");
		sym.innerHTML = config.id;
		sym.className = "symbol";
		item.appendChild(sym);
	}

	return item;
}

/**
 * The prompt and symbol test function
 *
 * This function would be called by eval() in filterConfigs().
 */

function _test(prompt, symbol, keyword) {
	if (keyword.startsWith('CONFIG_')) {
		const re = new RegExp(keyword.replace("CONFIG_", ""));
		return symbol.search(re) >= 0;
	} else {
		const re = new RegExp(keyword, "i");
		return prompt.search(re) >= 0 || symbol.search(re) >= 0;
	}
}

function filterConfigs() {
	const input = document.getElementById("search-box");
	const results = document.getElementById("search-results");

	results.innerHTML = ""; // Clear all of child nodes

	if (input.value === "") {
		document.getElementById("search-results").dataset.show = false;
		return;
	}

	const configs = document.getElementById("configs").querySelectorAll(".config:not(.no-prompt):not(.invisible):not(.comment)")

	let nfound = false;
	for (let n of configs) {
		let symbol = n.id;
		if (n.classList.contains("menu") && !n.dataset.hasSymbol) {
			symbol = "";
		}

		let prompt = n.querySelector(".prompt");
		let formula = input.value.replace(/&/g, "&&").replace(/[|]/g, "||");
		formula = formula.replace(/\w*/g, (match) => {
			if (match.length == 0) {
				// XXX: This regexp pattern matches zero length string.
				// I don't know why match it, ignore anyway.
				return "";
			}
			const text = prompt.textContent.replace(/"/g, '\\"');
			return `_test("${text}", '${symbol}', '${match}')`;
		});

		try {
			if (eval(formula)) {
				results.appendChild(createResultItem(n, prompt));
				nfound = true;
			}
		} catch(error) {
			break;
		}
	}
	document.getElementById("search-results").dataset.show = nfound;
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
		} else if (opt instanceof BoolWidget || opt instanceof ChoiceOption || opt instanceof TristateWidget) {
			if (opt.value === "y" || opt.value === "2") {
				config = `CONFIG_${opt.name}=y`;
			} else if (opt.value === "m" || opt.value === "1") {
				config = `CONFIG_${opt.name}=m`;
			} else if (opt.value === "n" || opt.value === "0") {
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

function changeVisibility() {
	const old = inactive;
	inactive = inactive === "invisible" ? "inactive" : "invisible";
	const configs = document.querySelectorAll(".config." + old);

	for (let n of configs) {
		n.classList.replace(old, inactive);
	}
}

function main() {

	if (document.body.dataset.mode === "Kernel") {
		inactive = "invisible";
	} else {
		inactive = "inactive";
	}
	if (document.body.dataset.mode === undefined) { // SDK2.0
		inactive = "invisible";
	}

	// Apply inactive type to visibility icon
	if (inactive === "invisible") {
		document.getElementById("visibility-icon").classList.add("off");
	}

	document.getElementById("search-box").addEventListener("keyup", filterConfigs);
	document.getElementById("search-box").addEventListener("search", filterConfigs);
	document.getElementById("search-icon").addEventListener("click", event => {
		let search = document.getElementById("search");
		search.classList.toggle("show");
		if (search.classList.contains("show")) {
			document.getElementById("search-box").focus();
		}
	});

	document.getElementById("visibility-icon").addEventListener("click", event => {
		document.getElementById("visibility-icon").classList.toggle("off");
		changeVisibility();

		// Clear search box for prevent search result is affected by
		// config visibility.
		document.getElementById("search-box").value = "";
		filterConfigs();
	});

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

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
const INT = 27;
const STRING = 47;
const TRISTATE = 48;
const CHOICE = 4;

const DEFAULT_HELP = "There is no help available for this option.";

// Convert number to tristate strings

const YMN = {0: "n", 1: "m", 2: "y"};

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
let choiceList;

// Hold a status of building widget class tree. If it is true,
// no propagation is running caused by value changes.

var underConstruction;

// menuId is for set ID to menu checkbox
var menuId;

// The choice option has not the actual symbol, so we need to
// assign the ID for scroll to them.
var choiceId;

// modules option, it would be BoolWidget actually.
// the Modules option will be affected to tristate options.
var MODULES;

// Call stack for propagate and evaluate calling.
// Each methods uses this stack to check that propagating and
// evaluating node is already propagated or evaluated.
// This logic is for avoid looping the propagation of value changes.
let propagateCallstack = [];

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
		}
	}

	get(symbol) {
        if (this.db[symbol]) {
			return this.db[symbol];
        }
        return null;
	}

    *[Symbol.iterator]() {
        for (let obj of Object.values(this.db)) {
            yield obj;
        }
    }
}

/*
 * Dump propagate call stack
 *
 * This function useful for debugging.
 */

function dumpPropagateStack(outfn=console.debug) {
	outfn('propagateStack:');
	for (let i in propagateCallstack) {
		let o = propagateCallstack[i];
		outfn(` [${i}] ${o.name}`);
	}
}

class BaseWidget {

	constructor(node) {

		this._node = node;
		this._active = true;
		this._referrers = new Set(); // Holds object list to referrers

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
				if (node.hasOwnProperty("help")) {
					help.innerHTML = node.help.replace(/\n/g,"<br>");
				} else {
					help.innerHTML = DEFAULT_HELP;
				}

				// Append dependency information
				let dep = "";
				if (node.dep && node.dep !== "y") {
					dep += "<br>Depends on: " + node.dep;
				}
				if (node.selects) {
					for (let s of node.selects) {
						dep += "<br>Selects: " + s.symbol;
						if (s.cond && s.cond !== "y") {
							dep += " if " + s.cond;
						}
					}
				}

				if (dep.length > 0) {
					help.innerHTML += "<br>" + dep;
				}
			});
			this._element.appendChild(e);
		} else {
			this._element.classList.add("no-prompt");
		}

		if (node.hasOwnProperty("name")) {
			let e = document.createElement("div");
			e.className = "symbol";
			e.innerHTML = node.name;
			this._element.appendChild(e);
			this._element.id = node.name;
		}

		if (node.hasOwnProperty("value")) {
			this._value = node.value;
		} else {
			this._value = undefined;
		}

		if (node.hasOwnProperty("user_value")) {
			this.user_value = node.user_value;
		} else {
			this.user_value = undefined;
		}

		this._typedefault = undefined;
	}

	depend() {
		// Guard to multiple depend for ChoiceWidget, it will be called
		// from children.

		if (this._dependDone) {
			return;
		}

		// Collect dependency symbols from conditional expressions.
		// They existed in below.
		// - Option's own dependency ('depends on', in cond field)
		// - 'if <expr>' statement in 'default', 'range', 'select' and 'imply' keywords
		//
		// Each option needs notification from above target symbols when it has been changed,
		// so add this object into referrers list in the target symbols.

		let refs = new Set();

		// Shorthands for collecting symbols from expressions into refs
		const _collect = (expr) => expr?.match(/[\w]+/g)?.forEach((value) => {
			if (!/(^[ymn]$|^[\d]+$)/.test(value)) {
				refs.add(value);
			}
		});
		const _collectlist = (list) => list?.forEach((val) => {
			_collect(val.name);
			_collect(val.default);
			_collect(val.cond);
		});

		_collect(this._node.dep);
		_collect(this._node.rev_dep);
		_collect(this._node.weak_rev_dep);
		_collectlist(this._node.defaults);
		_collectlist(this._node.ranges);
		// Collect 'if' option expressions
		_collectlist(this._node.selects);
		_collectlist(this._node.implies);

		// Register this object to depended options.
		for (let r of refs) {
			let target = optiondb.get(r);
			if (target) {
				target._referrers.add(this);
			}
		}

		this._dependDone = true;
	}

	isSelected() {
		return this._node.rev_dep && evaluateCond(this._node.rev_dep);
	}

	propagate() {
		// Don't propagate while widgets under construction
		if (underConstruction) {
			return;
		}

		for (var node of this._referrers) {
			if (propagateCallstack.includes(node)) {
				continue;
			}
			propagateCallstack.push(this);
			node.evaluate();
			propagateCallstack.pop();
		}
	}

	evaluate() {
		let active = this._node.dep ? evaluateCond(this._node.dep) : true;

		this._active = active;
		this._activate(active);
		this.propagate();
		this._setVisibility(active);
	}

	_activate(active) {
		if (active) {
			// Restore user value
			// If user_value is undefined, evaluate default keyword later. 
			let val = this.user_value;

			if (this.isSelected()) {
				// 'select'ed symbol is boolean option, so we set "y" constantly.
				val = "y";
			}

			// Evaluate 'imply'ed keyword dependency
			if (this._node.weak_rev_dep) {
				val = YMN[evaluateExpr(this._node.weak_rev_dep)];
			}

			this.setValue(val);
		}
	}

	_setVisibility(visible) {
		if (visible) {
			this._element.classList.remove(inactive);
			this.activateInputElement();
		} else {
			this._element.classList.add(inactive);
			this.deactivateInputElement();
		}
	}

	// All of subclasses must have activated and deactivated method.
	// These functions would be called from evaluate(), and they must be
	// control the visibility of input tag they have.

	activateInputElement() {
		this._input.value = this._value;
		this._input.removeAttribute("disabled");
	}

	deactivateInputElement() {
		this._input.value = "";
		this._input.setAttribute("disabled", "disabled");
	}

	/**
	 * Get default value from defaults list.
	 * If option node does not have defaults list, return undefined.
	 */

	getDefault() {
		if (this._node.defaults) {
			for (let def of this._node.defaults) {
				if (evaluateCond(def.cond)) {
					// If name and default are different, name may reference to
					// other symbol.
					if (def.name !== def.default) {
						if (isStatefulOption(this) && def.name === null) {
							// If name field in default list is null, it is stateful type option
							// and reference other symbols in default field.
							let val = evaluateExpr(def.default);
							return YMN[val];
						} else {
							let opt = optiondb.get(def.name);
							return opt ? opt.value : def.default;
						}
					}
					return def.default;
				}
			}
		}
		return this._typedefault;
	}

	/**
	 * Set specified value to option
	 *
	 * @param {string} x The value will be set. If undefeind, leave it to default.
	 * @returns true when the value is changed, false is not changed.
	 */

	setValue(x) {
		if (x === undefined || x === null) {
			x = this.getDefault();
		}

		if (this._value !== x) {
			this._value = this._input.value = x;
			this.propagate();
			return true;
		}

		return false;
	}

	/**
	 * Set initial state from precalculated dependency.
	 */

	setInitialState() {
		this._active = this._node.visible === 'y';
		this._setVisibility(this._active);
	}

	get element() {
		return this._element;
	}

	/**
	 * Setter method to option value
	 *
	 * Do not call this function from outside of classes, call
	 * setValue() instead.
	 *
	 * @param {string} x
	 */

	set value(x) {
		this._element.dataset.configured = x; // remain for debug
		this._value = x;
	}

	get value() {
		if (!this.active) {
			return this._typedefault;
		}
		return this._value;
	}

	get name() {
		return this._node.name ? this._node.name : this._element.id;
	}

	set active(val) {
		this._active = val;
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
		this._typedefault = 'n';

		// Convert 0, 1, 2 to n, m, y, respectively.
		if (this.user_value !== null) {
			this.user_value = YMN[this.user_value];
		}
		this.modules = node.hasOwnProperty("modules");

		this._body = this._element;
		if (node.hasOwnProperty("menuconfig") && node.menuconfig) {
			// Replace responsive element to menu container

			this.transformMenuConfig();
		}

		let label = document.createElement("label");
		label.className = "bool";
		this._body.appendChild(label);

		this._input = document.createElement("input");
		this._input.type = "checkbox";
		this._input.checked = this._value === "y";

		this._input.addEventListener("change", (event) => {
			this._value = event.target.checked ? "y" : "n";
			if (this.isSelected()) {
				this._value = "y";
				event.target.checked = true;
			}
			this.user_value = this._value;
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

	activateInputElement() {
		this._input.checked = this._value === "y";
		this._input.removeAttribute("disabled");
	}

	deactivateInputElement() {
		this._input.checked = false;
		this._input.setAttribute("disabled", "disabled");
	}

	setValue(x) {
		if (x === undefined || x === null) {
			x = this.getDefault();
			// WORKAROUND: Some config returns '0' as default (maybe mistake)
			// it treated as n, m, y.
			if (x >= 0 && x <= 2) {
				console.warn(`Config ${this.name} default ${x}. treated as "${YMN[x]}"`);
				x = YMN[x];
			}
		}
		if (this.isSelected()) {
			x = "y";
		}

		if (this._value !== x) {
			this._value = x;
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

		let id = "menu-" + menuId++;
		let input = document.createElement("input");
		let label = document.createElement("label");
		let prompt = document.createElement("div");
		let symbol = document.createElement("div");
		input.type = "checkbox";
		input.id = id;

		prompt.innerHTML = this._node.prompt;
		prompt.className = "prompt";
		symbol.innerHTML = this._node.name;
		symbol.className = "symbol";
		label.classList.add("menu", "config");
		label.setAttribute("for", id);
		label.id = this._node.name;
		label.dataset.hasSymbol = "1";
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
		this._typedefault = '0x0';
		this._element.classList.add("hex");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this._element.appendChild(this._input);

		this._input.addEventListener("keyup", (event) => {
			var _pat = /^0x[0-9a-fA-F]+$/;
			var m = _pat.test(event.target.value);

			if (event.target.value.length === 0 || m) {
				event.target.style.backgroundColor = "";
			} else {
				event.target.style.backgroundColor = "rgb(255, 153, 153)";
			}
		});

		this._input.addEventListener("change", (event) => {
			this._value = this.user_value = event.target.value;
			this.propagate();
		});

		this.setInitialState();
	}
}

class IntWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._typedefault = 0;
		this._element.classList.add("int");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this._input.value = this._value;
		this._element.appendChild(this._input);

		this._input.addEventListener("keyup", (event) => {
			this.checkRange();
		});

		this._input.addEventListener("change", (event) => {
			this._value = this.user_value = event.target.value;
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
			if (evaluateCond(r.cond)) {
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
		this._typedefault = 'n';
		if (this.user_value !== null) {
			this.user_value = YMN[this.user_value];
		}

		this._tristate = document.createElement("div");
		let _n = document.createElement("div");
		let _m = document.createElement("div");
		let _y = document.createElement("div");

		_n.innerHTML = "N";
		_m.innerHTML = "M";
		_y.innerHTML = "Y";

		this._tristate.append(_n, _m, _y);
		this._tristate.className = "tristate";
		this._tristate.dataset.value = this._value;
		this._tristate.addEventListener("click", (event) => {
			this.tristateNext();
		});
		this._element.append(this._tristate);

		this._m = _m;
		this.setInitialState();
	}

	activateInputElement() {
		this._tristate.classList.remove("disabled");
	}

	deactivateInputElement() {
		this._tristate.classList.add("disabled");
	}

	setValue(x) {
		if (x === undefined || x === null) {
			x = this.getDefault();
		}
		if (this._value !== x) {
			this._value = x;
			this._tristate.dataset.value = this._value;
			this.propagate();
			return true;
		}

		return false;
	}

	tristateNext() {
		if (this._tristate.classList.contains("disabled")) {
			return;
		}

		if (this._value === undefined || this._value === null) {
			this._value = this.getDefault();
			if (this._value === undefined || this._value === null) {
				this._value = 'n';
			}
		}

		switch (this._value) {
			case "n":
				if (MODULES.value === "y") {
					this._value = 'm';
				} else {
					this._value = 'y';
				}
				break;
			case "m":
				this._value = 'y';
				break;
			case "y":
				this._value = 'n';
				break;
		}
		this._tristate.dataset.value = this.user_value = this._value;
		this.propagate();
	}

	// Special method to reflect MODULES option changes.
	// user_value member is not changed in here because it holds user
	// selected data, and it will be restored by MODULES enabled again.

	modulesChange(enable) {
		if (enable) {
			this._m.innerHTML = "M";
			this._tristate.dataset.value = this._value = this.user_value;
		} else {
			this._m.innerHTML = "-";
			if (this._value === 'm') {
				this._tristate.dataset.value = this._value = 'y';
			}
		}
	}
}

class StringWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._typedefault = '';
		this._element.classList.add("string");
		this._input = document.createElement("input");
		this._input.type = "text";
		this._input.spellcheck = false;
		this._input.value = node.value;
		this._element.appendChild(this._input);

		this._input.addEventListener("change", () => {
			this._value = this.user_value = this._input.value;
			this.propagate();
		});

		this.setInitialState();
	}

	setValue(x) {
		if (x === undefined || x === null) {
			x = this.getDefault();
			if (x === undefined || x === null) {
				x = "";
			}
		}

		if (this._value !== x) {
			this._value = this._input.value = x;
			this.propagate();
			return true;
		}

		return false;
	}
}

class ChoiceWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._element.classList.add("choice");
		this._element.id = "choice-" + choiceId++;

		// Add symbol space because choice option has no name, so BaseWidget
		// constructor had not added.
		this.symbolelem = document.createElement("div");
		this.symbolelem.className = "symbol";
		this.symbolelem.innerHTML = "";
		this._element.appendChild(this.symbolelem);

		this._options = [];
		this._input = document.createElement("select");
		this.user_value = undefined;

		this.createSelectInputField();
		this._element.appendChild(this._input);

		this._input.addEventListener("change", (event) => {
			this.user_value = event.target.selectedOptions[0].id;
			propagateCallstack.push(this);
			for (let opt of this._options) {
				opt.select(opt.name === this.user_value);
			}
			propagateCallstack.pop();
			this.symbolelem.innerHTML = this.user_value;
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

			// Add parent dependency statically.
			opt._referrers.add(this);
			this._referrers.add(opt);
		}

		// Finally, actually select, make sure that 'selected' is exists but
		// it always chosen. If it is not, the helper script mistakes.

		if (selected) {
			this.setValue(selected);
		}
	}

	evaluate() {
		let active = true;

		if (this._node.dep) {
			active = evaluateCond(this._node.dep);
		}
		if (active) {
			for (let opt of this._options) {
				opt.updateCondition();
			}
		}

		// ChoiceWidget status should be changed before select each options.
		// Because each option values reflected this status.
		let changed = this._active !== active;
		this._active = active;

		let val = this.user_value || this.getDefault();
		for (let opt of this._options) {
			opt.select(opt.name === val, changed);
		}

		this._setVisibility(active);
		this.symbolelem.innerHTML = val || "";
	}

	getDefault() {
		if (this._node.defaults) {
			for (let def of this._node.defaults) {
				if (evaluateCond(def.cond)) {
					let opt = this._options.find(o => o.name === def.name);
					// See option _active directly to avoid affected by widget active status.
					if (opt._active) {
						return def.name;
					}
				}
			}
		}

		// When comes here, default option is found but it can't select because it is not active.
		// Find first active option and use it as default option.
		let opt = this._options.find(o => o._active);
		if (opt === undefined) {
			return this._input.options[0].id; // fail-safe code. may not comes here.
		}
		return opt.name;
	}

	choice(name, choice) {
		if (choice) {
			this.user_value = name;
		} else {
			// If selected option specified 'not selected', set undefined
			// to leave this value to be default.
			// Otherwise ignore.
			if (this.user_value === name) {
				this.user_value = undefined;
			}
		}
	}

	/**
	 * This method called from 1) ChoiceOption setValue and
	 * 2) propagation from other dependent options.
	 * If val is undefined, it is called from other options.
	 *
	 * @param {string} val Option symbol name
	 */

	setValue(val) {
		if (val === undefined || val === null) {
			val = this.user_value;
			if (val === undefined || val === null) {
				val = this.getDefault();
			}
		}
		if (this._value !== val) {
			for (let opt of this._options) {
				opt.select(opt.name === val);
			}
			this._value = this.user_value = val;
			this.symbolelem.innerHTML = this.user_value || "";
			// No propagate from here because choice type has no values.
		}
	}

	activateInputElement() {
		this._input.removeAttribute("disabled");
	}

	deactivateInputElement() {
		this._input.setAttribute("disabled", "disabled");
	}
}

class ChoiceOption extends BaseWidget {
	constructor(parent, node) {
		super(node);

		this._parent = parent;

		// Replace element
		this._element = document.createElement("option");
		this._element.classList.add("choice-opt", "config");
		this._element.id = node.name;
		this._element.innerHTML = node.prompt;

		this._value = node.value;

		this.setInitialState();
	}

	/*
	 * This function is for updating active status only because child active status
	 * is tied up with parent active status.
	 */

	updateCondition() {
		this._active = this._node.dep ? evaluateCond(this._node.dep) : true;
		this._setVisibility(this._active);
	}

	/**
	 * Set value to this option
	 *
	 * This function overwrite but behavior is different from others.
	 * The choice option needs to be combined to other choice items, so this function set
	 * choiced symbol to the parent. Actual setting value and propagation doing at select(),
	 * via parent evaluation.
	 *
	 * @param {string} val "y" or "n"
	 */

	setValue(val) {
		if (val === 'y' || val === 'n') {
			this._parent.choice(this.name, val === 'y');
		}
	}

	// Each choice option has no defaults, so pass to parent methods
	// about default related process.

	activateInputElement(def) {
		// nothing to do
	}

	deactivateInputElement(def) {
		// nothing to do
	}

	/**
	 * Select this option, this method will be called by ChoiceWidget
	 *
	 * @param {boolean} selected true if selected this option, false is not selected.
	 * @param {boolean} changed true if parent active status has been changed.
	 */

	select(selected, changed=false) {
		this._element.selected = selected;
		let val = selected ? 'y' : 'n';
		// TODO: need to process of implied!

		if (changed || this._value !== val) {
			this._value = val;
			this.propagate();
		}
	}

	// Overwrite active accessor, because choice option active status is relative to
	// parent active status.
	set active(val) {
		this._active = val;
	}

	get active() {
		return this._parent.active && this._active;
	}
}

class MenuWidget extends BaseWidget {
	constructor (node) {
		super(node);

		// Add special menu container for create new menu structure
		// to use expandable menu.
		this._element = document.createElement("div");
		this._element.classList.add("menu-container");

		let id = "menu-" + menuId++;
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

	activateInputElement() {
		// do nothing
	}
	deactivateInputElement() {
		// do nothing
	}
	setValue() {
		return true;
	}
}

class CommentWidget extends BaseWidget {
	constructor(node) {
		super(node);
		this._element.classList.add("comment");

		this.setInitialState();
	}

	activateInputElement() {
		// do nothing
	}
	deactivateInputElement() {
		// do nothing
	}
	setValue() {
		return true;
	}
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
			choiceList.push(widget);
			break;

		default:
			console.log("ignore type " + node.type);
			return null; // may not comes here
	}

	return widget;
}

function isStatefulOption(obj) {
	return obj instanceof BoolWidget || obj instanceof TristateWidget || obj instanceof ChoiceOption;
}

function layoutConfigs(parent, list) {

	for (let n of list) {
		let widget = widgetFactory(n);
		if (widget) {
			parent.appendChild(widget.element);

			if (n.children && !(widget instanceof ChoiceWidget)) {

				if (widget.hasOwnProperty('menuitems')) {
					layoutConfigs(widget.menuitems, n.children);
				} else {
					// Add children to the same level of this widget, it
					// may be a bool option.
					layoutConfigs(parent, n.children);
				}
			}
		}
	}
}

function getKeyFromValue(object, value) {
	return Object.keys(object).find(key => object[key] === value);
}

function getConfiguredValue(name) {
	let val = getKeyFromValue(YMN, name);
	if (val) {
		// if 'y', 'm', 'n' passed in name, return its values.
		return val;
	}

	let opt = optiondb.get(name);
	if (opt) {
		// XXX: This process the values in respective option types.
		// It may it is better to be added in each classes.
		if (isStatefulOption(opt)) {
			if (!opt.value || opt.value === "") {
				val = 0;
			} else {
				val = getKeyFromValue(YMN, opt.value);
				if (val === undefined) {
					// If value is not a 'n', 'm' and 'y', it treat as symbol,
					// so evaluate again.
					val = evaluateExpr(opt.value);
				}
			}
			return val;
		} else if (opt instanceof StringWidget) {
			// String value needs quoted
			return '\"' + opt.value + '\"';
		} else {
			// Int and Hex type options are constant symbol,
			// so just return its value.
			// Returns zero when undefined or not set ("").
			if (opt.value === "" || opt.value === undefined) {
				return 0;
			}
			return opt.value;
		}
	} else {
		// If name is not symbol, return 0
		return 0;
	}
}

function evaluateExpr(s) {
	let _s = s;
	let m = s.match(/[\w]+/g);
	const isnum = /^\d+$/;
	const ishex = /^0x[a-fA-F\d]+$/;

	for (let value of m) {
		if (!isnum.test(value) && !ishex.test(value)) {
			var v = getConfiguredValue(value);
			_s = _s.replace(value, v);
		}
	}

	// Replace equal comparison to JavaScript style.
	_s = _s.replace(/[!<>]?=/g, (x) => {
		return x === "=" ? "===" : x;
	});
	// Replace '!SYMBOL' ('not' pattern) to invert tristate value
	_s = _s.replace(/!(\d)/g, '(2-$1)');

	//console.debug(`${s} => ${_s}`);
	let ret;
	try {
		ret = eval(_s);
		if (ret === true) {
			ret = 2;
		} else if (ret === false) {
			ret = 0;
		}
	} catch {
		console.warn(`Caught unexpected exception! "${s}" => "${_s}"`);
		ret = 0;
	}

	return ret;
}

function evaluateCond(s) {
	return !!evaluateExpr(s);
}

function invalidateTristate() {
	if (MODULES !== null) {
		for (let t of tristateList) {
			t.modulesChange(MODULES.value === "y");
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
	choiceList = [];
	MODULES = null;

	if (!data.children) {
		return;
	}

	menuId = 0;
	choiceId = 0;

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
	for (let c of choiceList) {
		c.depend();
	}
	for (let c of choiceList) {
		propagateCallstack.push(c);
		c.evaluate();
		propagateCallstack.pop();
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
	// so parent variable pointed must be .menu-container.

	let parent = node.parentNode.parentNode;
	if (node.tagName === "OPTION") {
		parent = parent.parentNode.parentNode;
	}
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

		// option tag can't use scrollIntoView() function, so we jump into
		// parent div tag (div > select > option).
		if (opt.tagName === "OPTION") {
			opt.parentNode.parentNode.scrollIntoView();
		} else {
			opt.scrollIntoView();
		}
	} else {
		console.log("No symbols for " + event.target.textContent);
	}
}

function createResultItem(config, prompt) {
	let item = document.createElement("div");

	const p = document.createElement("div");
	p.className = "prompt";
	p.innerText = prompt.innerText;

	item.className = "item";
	item.appendChild(p);
	item.addEventListener("click", jumpToConfig);
	item.dataset.symbol = config.id;

	if (!config.id.match(/^choice-\d+/) && !config.id.match(/menu-\d+-label/)) {
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
		results.dataset.show = false;
		return;
	}
	if (input.value.length < 2) {
		return;
	}
	results.dataset.show = false;

	const configs = document.getElementById("configs").querySelectorAll(".config:not(.no-prompt):not(.invisible):not(.comment)");

	let nfound = false;
	for (let n of configs) {
		// Ignore invisible menu and invisible choice options
		if (n.tagName === "LABEL" && n.parentNode.classList.contains("invisible")) {
			continue;
		}
		if (n.tagName === "OPTION" && n.parentNode.parentNode.classList.contains("invisible")) {
			continue;
		}

		let symbol = n.id;
		if (n.classList.contains("menu") && !n.dataset.hasSymbol) {
			symbol = "";
		}

		let prompt = n.querySelector(".prompt");
		if (n.tagName === "OPTION") {
			prompt = n;
		}
		let formula = input.value.replace(/&/g, "&&").replace(/[|]/g, "||");
		formula = formula.replace(/\w*/g, (match) => {
			if (match.length === 0) {
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
	results.dataset.show = nfound;
}

function generateConfigFileContent() {
	var buf = [];

	for (let opt of optiondb) {
		if (!opt.active) {
			continue;
		}
		if (opt.value === undefined || opt.value === null) {
			continue;
		}

		let config = undefined;

		if (opt instanceof StringWidget) {
			config = `CONFIG_${opt.name}="${opt.value}"`;
		} else if (isStatefulOption(opt)) {
			if (opt.value === "y") {
				config = `CONFIG_${opt.name}=y`;
			} else if (opt.value === "m") {
				config = `CONFIG_${opt.name}=m`;
			} else if (opt.value === "n") {
				config = `# CONFIG_${opt.name} is not set`;
			}
		} else {
			// int and hex values
			config = `CONFIG_${opt.name}=${opt.value}`;
		}

		if (config === undefined) {
			console.warn(`${opt.name} (${opt.value}) is undefined!`);
		}
		buf.push(config);
	}

	return buf.join("\n") + "\n";
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
		opt.user_value = undefined;
	}
	for (let opt of choiceList) {
		opt.user_value = undefined;
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
		if (val) {
			if (opt instanceof StringWidget) {
				// Peek string value and check it is welformed.
				let m = val.match(/"((?:[^"]|.)*)"/);
				if (!m) {
					console.warn(`Found malformed string value. Ignored. ${m[0]}`);
					continue;
				}
				// Unescape
				val = m[1].replace(/\\(.)/g, "$1");
			}
			opt.user_value = val;
		}
		opt.setValue(val);
	}

	// Invalidate choice config after all of the choice items has been set.
	for (let opt of choiceList) {
		propagateCallstack.push(opt);
		opt.evaluate();
		propagateCallstack.pop();
	}
}

function changeVisibility() {
	const old = inactive;
	inactive = inactive === "invisible" ? "inactive" : "invisible";
	const configs = document.querySelectorAll("." + old);

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

	document.getElementById("search-box").addEventListener("input", filterConfigs);

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
		showProgress();
		setTimeout(() => {
			vscode.postMessage({command: "save", content: generateConfigFileContent()});
		});
	});

	document.getElementById("saveas").addEventListener("click", event => {
		showProgress();
		setTimeout(() => {
			vscode.postMessage({command: "saveas", content: generateConfigFileContent()});
			hideProgress();
		});
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
							showProgress();
							vscode.postMessage({command: "load-defconfigs", content: data});
						}
					});
				}
				break;

			case "load-defconfigs":
				loadConfig(message.content);
				hideProgress();
				break;

			case "saved":
				hideProgress();
				break;
		}
	});
}
main();

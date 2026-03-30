#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.length > 3 && this._name.slice(-3) === "...") {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        return `${option.description} (${extraInfo.join(", ")})`;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      if (argumentList.length > 0) {
        output = output.concat([
          helper.styleTitle("Arguments:"),
          ...argumentList,
          ""
        ]);
      }
      const optionList = helper.visibleOptions(cmd).map((option) => {
        return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
      });
      if (optionList.length > 0) {
        output = output.concat([
          helper.styleTitle("Options:"),
          ...optionList,
          ""
        ]);
      }
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        if (globalOptionList.length > 0) {
          output = output.concat([
            helper.styleTitle("Global Options:"),
            ...globalOptionList,
            ""
          ]);
        }
      }
      const commandList = helper.visibleCommands(cmd).map((cmd2) => {
        return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(cmd2)), helper.styleSubcommandDescription(helper.subcommandDescription(cmd2)));
      });
      if (commandList.length > 0) {
        output = output.concat([
          helper.styleTitle("Commands:"),
          ...commandList,
          ""
        ]);
      }
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process2 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      Object.assign(this._outputConfiguration, configuration);
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, fn, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof fn === "function") {
        argument.default(defaultValue).argParser(fn);
      } else {
        argument.default(fn);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument && previousArgument.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        return this;
      }
      enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._concatValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise && promise.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent && this.parent.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(argv) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      const args = argv.slice();
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      let activeVariadicOption = null;
      while (args.length) {
        const arg = args.shift();
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args);
          break;
        }
        if (activeVariadicOption && !maybeOption(arg)) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args.shift();
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (args.length > 0 && !maybeOption(args[0])) {
                value = args.shift();
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              args.unshift(`-${arg.slice(2)}`);
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (maybeOption(arg)) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg);
            if (args.length > 0)
              operands.push(...args);
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg);
          if (args.length > 0)
            dest.push(...args);
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          this._helpOption = this._helpOption ?? undefined;
        } else {
          this._helpOption = null;
        }
        return this;
      }
      flags = flags ?? "-h, --help";
      description = description ?? "display help for command";
      this._helpOption = this.createOption(flags, description);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// src/config.ts
var exports_config = {};
__export(exports_config, {
  saveConfig: () => saveConfig,
  loadConfig: () => loadConfig,
  getToken: () => getToken,
  getProject: () => getProject,
  getApiUrl: () => getApiUrl
});
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
function getConfigFilePath() {
  return process.env.OPSY_CONFIG_PATH ?? DEFAULT_CONFIG_FILE;
}
function getConfigDirPath() {
  return dirname(getConfigFilePath());
}
function loadConfig() {
  try {
    return JSON.parse(readFileSync(getConfigFilePath(), "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(config) {
  mkdirSync(getConfigDirPath(), { recursive: true });
  writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2) + `
`);
}
function getToken(flags) {
  const token = flags.token ?? process.env.OPSY_TOKEN ?? loadConfig().token;
  if (!token) {
    console.error("Error: No token. Set OPSY_TOKEN, use --token, or run `opsy auth login`.");
    process.exit(1);
  }
  return token;
}
function getApiUrl(flags) {
  return flags.apiUrl ?? process.env.OPSY_API_URL ?? loadConfig().apiUrl ?? "https://api.opsy.sh";
}
function getProject(flags) {
  return flags.project ?? process.env.OPSY_PROJECT ?? loadConfig().project;
}
var DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE;
var init_config = __esm(() => {
  DEFAULT_CONFIG_DIR = join(homedir(), ".opsy");
  DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, "config.json");
});

// ../contracts/observe.ts
function getUnsupportedObserveProviderMessage(provider) {
  return `Observability is not implemented for "${provider}". Use "observability" to list supported providers.`;
}
function getObserveProviderHelpCatalog(provider) {
  if (provider === "aws")
    return OBSERVE_AWS_HELP_CATALOG;
  return null;
}
function findObserveCommandHelp(provider, path) {
  const catalog = getObserveProviderHelpCatalog(provider);
  return catalog?.commands.find((entry) => entry.path.join(" ") === path.join(" "));
}
function renderObserveSupportedProviders() {
  return `Supported observability providers:
${OBSERVE_PROVIDERS.map((provider) => `  ${provider.id}`).join(`
`)}`;
}
function renderObserveProviderHelp(provider) {
  const catalog = getObserveProviderHelpCatalog(provider);
  if (!catalog)
    return getUnsupportedObserveProviderMessage(provider);
  const sections = catalog.commands.map((entry) => {
    const notes = entry.notes?.length ? `
  Notes: ${entry.notes.join(" ")}` : "";
    const examples = entry.examples.map((example) => `  Example: ${example}`).join(`
`);
    return `${entry.synopsis}
  ${entry.purpose}${notes}
${examples}`;
  });
  return `${catalog.title}
  ${catalog.intro}

Notes:
${catalog.notes.map((note) => `  - ${note}`).join(`
`)}

${sections.join(`

`)}`;
}
var OBSERVE_PROVIDERS, OBSERVE_TIME_NOTES, OBSERVE_AWS_HELP_CATALOG;
var init_observe = __esm(() => {
  OBSERVE_PROVIDERS = [
    { id: "aws", label: "AWS" }
  ];
  OBSERVE_TIME_NOTES = [
    "Time values accept ISO timestamps or relative durations like 30s, 15m, 1h, or 7d.",
    "JSON-typed options use raw AWS-like JSON arrays for --dimensions and --queries."
  ];
  OBSERVE_AWS_HELP_CATALOG = {
    provider: "aws",
    title: "AWS CloudWatch observability commands",
    intro: "Read-only CloudWatch logs, metrics, and alarms for a project or explicit AWS profile.",
    notes: OBSERVE_TIME_NOTES,
    commands: [
      {
        path: ["logs", "groups"],
        synopsis: "observability aws logs groups --project <project> [--profile <profileId>] [--region <aws-region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
        purpose: "List CloudWatch log groups.",
        examples: [
          "observability aws logs groups --project acme",
          "observability aws logs groups --project acme --name-prefix /aws/lambda/"
        ]
      },
      {
        path: ["logs", "tail"],
        synopsis: "observability aws logs tail --project <project> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]",
        purpose: "Fetch a bounded one-shot view of recent log events, newest first.",
        examples: [
          "observability aws logs tail --project acme --log-group /aws/lambda/payments",
          "observability aws logs tail --project acme --log-group /aws/ecs/app --since 1h --filter-pattern ERROR"
        ],
        notes: ["Default --since is 15m."]
      },
      {
        path: ["logs", "events"],
        synopsis: "observability aws logs events --project <project> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
        purpose: "Retrieve filtered log events in chronological order.",
        examples: [
          "observability aws logs events --project acme --log-group /aws/lambda/payments --since 30m",
          "observability aws logs events --project acme --log-group /aws/ecs/app --log-stream ecs/app/123"
        ]
      },
      {
        path: ["logs", "query"],
        synopsis: "observability aws logs query --project <project> --log-groups <csv> --query-string <text> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]",
        purpose: "Run a CloudWatch Logs Insights query and poll until completion.",
        examples: [
          "observability aws logs query --project acme --log-groups /aws/lambda/payments --query-string 'fields @timestamp, @message | sort @timestamp desc | limit 20'",
          "observability aws logs query --project acme --log-groups /aws/lambda/a,/aws/lambda/b --since 2h --query-string 'stats count() by bin(5m)'"
        ],
        notes: ["Default --since is 1h. Default --timeout-seconds is 15."]
      },
      {
        path: ["metrics", "list"],
        synopsis: "observability aws metrics list --project <project> [--profile <profileId>] [--region <aws-region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]",
        purpose: "List CloudWatch metric descriptors and dimension sets.",
        examples: [
          "observability aws metrics list --project acme --namespace AWS/Lambda",
          "observability aws metrics list --project acme --namespace AWS/EC2 --metric-name CPUUtilization"
        ]
      },
      {
        path: ["metrics", "query"],
        synopsis: "observability aws metrics query --project <project> --queries <json-array> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]",
        purpose: "Run CloudWatch GetMetricData queries and return raw datapoints.",
        examples: [
          `observability aws metrics query --project acme --queries '[{"Id":"cpu","MetricStat":{"Metric":{"Namespace":"AWS/EC2","MetricName":"CPUUtilization","Dimensions":[{"Name":"InstanceId","Value":"i-123"}]},"Period":300,"Stat":"Average"}}]'`,
          `observability aws metrics query --project acme --queries '[{"Id":"errors","Expression":"SUM(METRICS())"}]' --since 6h`
        ],
        notes: ["Default --since is 1h. Default --until is now."]
      },
      {
        path: ["alarms", "list"],
        synopsis: "observability aws alarms list --project <project> [--profile <profileId>] [--region <aws-region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
        purpose: "List CloudWatch metric and composite alarms.",
        examples: [
          "observability aws alarms list --project acme",
          "observability aws alarms list --project acme --state ALARM --type metric"
        ],
        notes: ["Default --type is all."]
      },
      {
        path: ["alarms", "detail"],
        synopsis: "observability aws alarms detail --project <project> --alarm-name <name> [--profile <profileId>] [--region <aws-region>]",
        purpose: "Fetch the full current config and state for one alarm.",
        examples: [
          "observability aws alarms detail --project acme --alarm-name HighCPU",
          "observability aws alarms detail --project acme --alarm-name CompositeLatencyAlarm"
        ]
      },
      {
        path: ["alarms", "history"],
        synopsis: "observability aws alarms history --project <project> --alarm-name <name> [--profile <profileId>] [--region <aws-region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
        purpose: "List CloudWatch alarm history entries.",
        examples: [
          "observability aws alarms history --project acme --alarm-name HighCPU",
          "observability aws alarms history --project acme --alarm-name HighCPU --history-item-type StateUpdate --since 7d"
        ],
        notes: ["Default --since is 24h."]
      }
    ]
  };
});

// ../contracts/commands.ts
function flags(...entries) {
  return entries;
}
function command(spec) {
  return spec;
}
function renderFlags(spec) {
  if (!spec.flags?.length) {
    return "";
  }
  return `
Flags:
${spec.flags.map((flag) => {
    const name = `--${flag.name}${flag.value ? ` ${flag.value}` : ""}`;
    const required = flag.required ? " (required)" : "";
    return `  ${name}${required}  ${flag.description}`;
  }).join(`
`)}`;
}
function renderBulletedSection(title, lines) {
  if (!lines?.length) {
    return "";
  }
  return `
${title}:
${lines.map((line) => `  ${line}`).join(`
`)}`;
}
function renderPrefixHelp(path, children) {
  const nextParts = [...new Set(children.map((spec) => spec.path[path.length]))].filter(Boolean);
  const lines = nextParts.map((part) => {
    const child = children.find((spec) => spec.path[path.length] === part && spec.path.length === path.length + 1);
    const summary = child?.summary ? `  ${child.summary}` : "";
    return `  ${part}${summary}`;
  });
  return `${path.join(" ")}

Subcommands:
${lines.join(`
`)}

Use \`opsy ${path.join(" ")} <action> --help\` for command details.`;
}
function findCommandSpec(path) {
  return OPSY_COMMAND_SPECS.find((spec) => spec.path.join(" ") === path.join(" "));
}
function listCommandSpecsForPrefix(path) {
  return OPSY_COMMAND_SPECS.filter((spec) => path.every((part, index) => spec.path[index] === part));
}
function addNextStep(message, nextStep) {
  return `${message} Next: ${nextStep}`;
}
function renderCommandErrorMessage(message) {
  if (message.includes("Next:")) {
    return message;
  }
  if (message === "Missing --project." || message === "Missing project slug.") {
    return addNextStep(message, "run `opsy project list` and retry with one returned slug as `--project <slug>`.");
  }
  if (message === "Missing resource slug.") {
    return addNextStep(message, "run `opsy resource list --project <slug>` and reuse one returned slug.");
  }
  if (message === "Missing change shortId.") {
    return addNextStep(message, "run `opsy change list --project <slug>` and reuse one returned shortId.");
  }
  const invalidJson = message.match(/^Invalid JSON in --([a-z-]+)\.$/);
  if (invalidJson) {
    const flag = invalidJson[1];
    if (flag === "mutations") {
      return addNextStep(message, "pass a valid JSON array, then continue with `opsy change create --project <slug> --mutations '[...]'` or `opsy change append <shortId> --mutations '[...]'`.");
    }
    if (flag === "inputs") {
      return addNextStep(message, "pass a valid JSON object, then retry the resource mutation command.");
    }
    return addNextStep(message, `pass valid JSON to \`--${flag}\` and retry the command.`);
  }
  if (message.includes('Project "') && message.includes("not found")) {
    return addNextStep(message, "run `opsy project list` to confirm the project slug, then retry with `--project <slug>`.");
  }
  if (message.includes('Resource "') && message.includes("not found")) {
    return addNextStep(message, "run `opsy resource list --project <slug>` to confirm the slug, or add `--parent <slug>` to keep traversing the tree.");
  }
  if (message.includes('Change "') && message.includes("not found")) {
    return addNextStep(message, "run `opsy change list --project <slug>` to confirm the shortId, then retry.");
  }
  return message;
}
function renderCommandHelp(path) {
  if (path.length === 0) {
    return TOP_LEVEL_HELP;
  }
  if (path[0] === "observability") {
    if (path.length === 1) {
      return `${renderObserveSupportedProviders()}
Use "opsy observability aws --help" for AWS observability commands.`;
    }
    if (path[1] === "aws") {
      if (path.length === 2) {
        return renderObserveProviderHelp("aws");
      }
      const observeHelp = findObserveCommandHelp("aws", path.slice(2));
      if (observeHelp) {
        const notes = observeHelp.notes?.length ? `
Notes:
${observeHelp.notes.map((note) => `  ${note}`).join(`
`)}` : "";
        const examples = observeHelp.examples.length ? `
Examples:
${observeHelp.examples.map((example) => `  ${example}`).join(`
`)}` : "";
        return `${observeHelp.synopsis}

${observeHelp.purpose}${notes}${examples}`;
      }
    }
  }
  const exact = findCommandSpec(path);
  if (exact) {
    return [
      `Usage:
  ${exact.usage}`,
      `
${exact.summary}`,
      renderFlags(exact),
      renderBulletedSection("When to use", exact.whenToUse),
      renderBulletedSection("Examples", exact.examples),
      renderBulletedSection("Notes", exact.notes),
      renderBulletedSection("What to do next", exact.nextSteps)
    ].join("");
  }
  const children = listCommandSpecsForPrefix(path);
  if (children.length > 0) {
    return renderPrefixHelp(path, children);
  }
  return `Unknown help topic: ${path.join(" ")}`;
}
function parseCommandString(command2) {
  const tokens = [];
  let current = "";
  let quote = null;
  for (let index = 0;index < command2.length; index++) {
    const char = command2[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  if (tokens[0] === "opsy") {
    tokens.shift();
  }
  const positionals = [];
  const flags2 = {};
  for (let index = 0;index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      flags2[name] = true;
      continue;
    }
    flags2[name] = next;
    index++;
  }
  return { positionals, flags: flags2 };
}
function normalizeCommandPath(positionals) {
  if (positionals.length === 0) {
    return [];
  }
  const [first] = positionals;
  if (first === "observability") {
    return positionals.slice(0, Math.min(positionals.length, 4));
  }
  if (first === "auth" || first === "project" || first === "environment" || first === "resource" || first === "change" || first === "provider" || first === "schema" || first === "feedback") {
    return positionals.slice(0, Math.min(positionals.length, 2));
  }
  return positionals;
}
function getObserveSupportedProvidersMessage() {
  return renderObserveSupportedProviders();
}
function getObserveProviderHelpMessage(provider) {
  return renderObserveProviderHelp(provider);
}
var OPSY_COMMAND_SPECS, TOP_LEVEL_HELP;
var init_commands = __esm(() => {
  init_observe();
  OPSY_COMMAND_SPECS = [
    command({
      id: "project.list",
      path: ["project", "list"],
      usage: "opsy project list",
      summary: "List projects you can target.",
      examples: [
        "opsy project list"
      ],
      whenToUse: [
        "Start here on a fresh install or fresh MCP session when you do not know any project slugs yet."
      ],
      nextSteps: [
        "Run `opsy resource list --project <slug>` with one returned project slug."
      ]
    }),
    command({
      id: "project.get",
      path: ["project", "get"],
      usage: "opsy project get <slug>",
      summary: "Get one project by slug.",
      examples: [
        "opsy project get acme"
      ],
      whenToUse: [
        "Use this when you already know the project slug and want to confirm its details before targeting resources inside it."
      ],
      nextSteps: [
        "Run `opsy resource list --project <slug>` to discover resources in that project."
      ]
    }),
    command({
      id: "project.create",
      path: ["project", "create"],
      usage: "opsy project create --slug <slug> --name <name>",
      summary: "Create a new project.",
      flags: flags({ name: "slug", value: "<slug>", required: true, description: "Project slug." }, { name: "name", value: "<name>", required: true, description: "Project display name." }),
      examples: [
        'opsy project create --slug acme --name "Acme Production"'
      ],
      whenToUse: [
        "Use this only when you need a brand new top-level project, not when you are trying to discover an existing one."
      ],
      nextSteps: [
        "Run `opsy resource list --project <slug>` after the project exists."
      ]
    }),
    command({
      id: "resource.list",
      path: ["resource", "list"],
      usage: "opsy resource list --project <project> [--parent <slug>] [--detailed]",
      summary: "List resources in a project. With no `--parent`, Opsy returns root resources first.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "parent", value: "<slug>", description: "List only the children under one resource slug." }, { name: "detailed", description: "Return full resource records instead of compact list rows." }),
      examples: [
        "opsy resource list --project acme",
        "opsy resource list --project acme --parent network"
      ],
      whenToUse: [
        "Use this as the default read-first entry point before `resource get`, `change create`, or one-off resource mutations.",
        "Traverse the tree top-down: roots first, then add `--parent <slug>` when you want to drill into children."
      ],
      nextSteps: [
        "Run `opsy resource get <slug> --project <slug>` for one returned resource.",
        "Use `--parent <slug>` with one returned root slug to keep traversing the tree."
      ]
    }),
    command({
      id: "resource.get",
      path: ["resource", "get"],
      usage: "opsy resource get <slug> --project <project>",
      summary: "Get one managed Opsy resource record.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }),
      examples: [
        "opsy resource get vpc --project acme"
      ],
      whenToUse: [
        "Use this after `resource list` when you need the managed Opsy record for one slug."
      ],
      nextSteps: [
        "Run `opsy resource read <slug> --project <slug>` when you want the live provider read for the same resource.",
        "Choose a mutation path: `opsy change create --project <slug>` for a draft, or `opsy resource update <slug> --project <slug> --inputs <json>` for a one-off mutation."
      ]
    }),
    command({
      id: "resource.discover",
      path: ["resource", "discover"],
      usage: "opsy resource discover --project <project> [--provider <provider>] [--type <type>] [--profile <profileId>] [--location <location>]",
      summary: "Browse provider inventory across managed and unmanaged resources.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "provider", value: "<provider>", description: "Optional provider id, e.g. aws or cloudflare." }, { name: "type", value: "<type>", description: "Optional type filter." }, { name: "profile", value: "<profileId>", description: "Optional integration profile id." }, { name: "location", value: "<location>", description: "Optional region/location filter." }),
      examples: [
        "opsy resource discover --project acme --provider aws",
        "opsy resource discover --project acme --provider cloudflare --type zone"
      ],
      whenToUse: [
        "Start here when you do not know the exact provider object yet or when you need to find unmanaged inventory to import or delete."
      ],
      nextSteps: [
        "Run `opsy resource read --project <slug> --type <type> --provider-id <id>` for one discovered object.",
        "Run `opsy resource import --project <slug> --slug <slug> --type <type> --provider-id <id>` before updating an unmanaged resource."
      ]
    }),
    command({
      id: "resource.read",
      path: ["resource", "read"],
      usage: "opsy resource read [slug] --project <project> [--type <type> --provider-id <id> --provider <provider> --profile <profileId>]",
      summary: "Run a live provider read for one managed slug or external selector.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "type", value: "<type>", description: "External resource type when reading unmanaged inventory." }, { name: "provider-id", value: "<id>", description: "External provider ID when reading unmanaged inventory." }, { name: "provider", value: "<provider>", description: "Optional provider override for unmanaged reads." }, { name: "profile", value: "<profileId>", description: "Optional integration profile id." }),
      examples: [
        "opsy resource read vpc --project acme",
        "opsy resource read --project acme --type cloudflare:index/zone:Zone --provider-id zone-123 --provider cloudflare"
      ],
      whenToUse: [
        "Use this when you already know the target resource and want the live provider read, not the stored managed record."
      ],
      nextSteps: [
        "Run `opsy resource get <slug> --project <slug>` for the managed Opsy record.",
        "Run `opsy resource import --project <slug> --slug <slug> --type <type> --provider-id <id>` before updating an unmanaged resource."
      ]
    }),
    command({
      id: "resource.create",
      path: ["resource", "create"],
      usage: "opsy resource create --project <project> --slug <slug> --type <type> --inputs <json> [--parent <slug>] [--depends-on <json>] [--auto-apply] [--summary <text>]",
      summary: "Create one resource by proposing a single mutation, previewing it by default, and applying only when --auto-apply is set.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "slug", value: "<slug>", required: true, description: "Resource slug." }, { name: "type", value: "<type>", required: true, description: "Pulumi resource token." }, { name: "inputs", value: "<json>", required: true, description: "Resource inputs JSON object." }, { name: "parent", value: "<slug>", description: "Optional parent resource slug." }, { name: "depends-on", value: "<json>", description: "JSON array of dependency slugs for explicit ordering." }, { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." }, { name: "summary", value: "<text>", description: "Optional change summary." }),
      examples: [
        `opsy resource create --project acme --slug vpc --type aws:ec2/vpc:Vpc --inputs '{"cidrBlock":"10.0.0.0/16"}'`,
        `opsy resource create --project acme --slug policy --type aws:s3/bucketPolicy:BucketPolicy --inputs '{"bucket":"demo"}' --depends-on '["public-access-block"]'`,
        `opsy resource create --project acme --slug site-zone --type cloudflare:index/zone:Zone --inputs '{"account":{"id":"<account-id>"},"zone":"example.com"}'`
      ],
      whenToUse: [
        "Use this for a one-off resource creation when you do not need to stage multiple mutations in a draft first."
      ],
      nextSteps: [
        "By default, run `opsy change apply <shortId>` if the preview looks correct. If you need a staged workflow instead, start with `opsy change create --project <slug>`."
      ]
    }),
    command({
      id: "resource.update",
      path: ["resource", "update"],
      usage: "opsy resource update <slug> --project <project> --inputs <json> [--remove-input-paths <json>] [--parent <slug>] [--depends-on <json>] [--auto-apply] [--version <n>] [--summary <text>]",
      summary: "Update one resource by proposing a single mutation, previewing it by default, and applying only when --auto-apply is set.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "inputs", value: "<json>", required: true, description: "Inputs JSON object." }, { name: "remove-input-paths", value: "<json>", description: "JSON array of nested input paths to remove." }, { name: "parent", value: "<slug>", description: "Move the resource under a different parent slug." }, { name: "depends-on", value: "<json>", description: "JSON array of dependency slugs for explicit ordering." }, { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." }, { name: "version", value: "<n>", description: "Optimistic-lock version." }, { name: "summary", value: "<text>", description: "Optional change summary." }),
      examples: [
        `opsy resource update vpc --project acme --inputs '{"enableDnsHostnames":true}'`,
        `opsy resource update policy --project acme --inputs '{}' --depends-on '["public-access-block"]'`
      ],
      whenToUse: [
        "Use this for a single direct edit after you have already inspected the managed resource with `resource get`."
      ],
      notes: [
        "Unmanaged resources must be imported first. External selectors are rejected on update."
      ],
      nextSteps: [
        "By default, run `opsy change apply <shortId>` if the preview looks correct. Use `opsy change create --project <slug>` instead when you want a reviewable draft with multiple steps."
      ]
    }),
    command({
      id: "resource.delete",
      path: ["resource", "delete"],
      usage: "opsy resource delete [slug] --project <project> [--recursive] [--auto-apply] [--type <type> --provider-id <id> --profile <profileId>]",
      summary: "Delete one managed resource or one external provider object, previewing first unless --auto-apply is set.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "recursive", description: "Delete descendants too." }, { name: "auto-apply", description: "Apply immediately after preview instead of returning a preview-only change." }, { name: "type", value: "<type>", description: "External resource type for approved provider-side deletes." }, { name: "provider-id", value: "<id>", description: "External provider ID for approved provider-side deletes." }, { name: "profile", value: "<profileId>", description: "Optional integration profile id for external deletes." }),
      examples: [
        "opsy resource delete old-bucket --project acme",
        "opsy resource delete --project acme --type cloudflare:index/zone:Zone --provider-id zone-123 --profile cf-prod"
      ],
      whenToUse: [
        "Use this for a one-off deletion after you have confirmed the target resource and scope."
      ],
      notes: [
        "External deletes always require approval, even when the project would normally auto-apply."
      ],
      nextSteps: [
        "By default, run `opsy change apply <shortId>` if the preview looks correct. Use `opsy change create --project <slug>` if this delete belongs in a larger staged change."
      ]
    }),
    command({
      id: "resource.import",
      path: ["resource", "import"],
      usage: "opsy resource import --project <project> --slug <slug> --type <type> --provider-id <id> [--profile <profileId>] [--summary <text>]",
      summary: "Adopt an existing external resource into managed Opsy state.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "slug", value: "<slug>", required: true, description: "Managed Opsy slug to create or claim." }, { name: "type", value: "<type>", required: true, description: "Pulumi type token." }, { name: "provider-id", value: "<id>", required: true, description: "External provider ID." }, { name: "profile", value: "<profileId>", description: "Optional integration profile id." }, { name: "summary", value: "<text>", description: "Optional change summary." }),
      examples: [
        "opsy resource import --project acme --slug example-zone --type cloudflare:index/zone:Zone --provider-id zone-123"
      ],
      whenToUse: [
        "Use this before `resource update` when the target exists in the provider but is not yet managed by Opsy."
      ],
      nextSteps: [
        "Run `opsy resource update <slug> --project <slug> --inputs <json>` after the import is accepted."
      ]
    }),
    command({
      id: "resource.forget",
      path: ["resource", "forget"],
      usage: "opsy resource forget <slug> --project <project> [--recursive] [--target-dependents] [--summary <text>]",
      summary: "Forget one resource from Opsy state by proposing a state-only removal and immediately attempting apply.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "recursive", description: "Forget descendants too." }, { name: "target-dependents", description: "Forget graph dependents too." }, { name: "summary", value: "<text>", description: "Optional change summary." }),
      examples: [
        "opsy resource forget old-bucket --project acme",
        "opsy resource forget network --project acme --recursive",
        "opsy resource forget provider --project acme --target-dependents"
      ],
      whenToUse: [
        "Use this when the cloud object is already gone or intentionally retained and you need Opsy to stop managing the recorded state."
      ],
      notes: [
        "This is state-only removal: Opsy does not call the provider delete method.",
        "Without `--recursive`, children block the forget. Without `--target-dependents`, graph dependents block the forget.",
        "`--target-dependents` expands from the requested root target; inferred dependents are not standalone apply targets."
      ],
      nextSteps: [
        "Inspect the returned change or approval result. Use `opsy change create --project <slug>` if this forget belongs in a larger staged change."
      ]
    }),
    command({
      id: "resource.diff",
      path: ["resource", "diff"],
      usage: "opsy resource diff <slug> --project <project>",
      summary: "Compare stored and live resource state."
    }),
    command({
      id: "resource.refresh",
      path: ["resource", "refresh"],
      usage: "opsy resource refresh <slug> --project <project>",
      summary: "Refresh a resource from cloud and recompute conflict state."
    }),
    command({
      id: "resource.accept-live",
      path: ["resource", "accept-live"],
      usage: "opsy resource accept-live <slug> --project <project>",
      summary: "Accept recorded live state into desired inputs immediately.",
      notes: [
        "Requires an `out_of_sync` resource with a recorded conflict snapshot.",
        "This updates stored desired inputs directly instead of creating a reviewable change."
      ]
    }),
    command({
      id: "resource.reconcile",
      path: ["resource", "reconcile"],
      usage: "opsy resource reconcile <slug> --project <project>",
      summary: "Promote recorded live state into desired inputs through a change.",
      whenToUse: [
        "Use this when a resource is `out_of_sync` and you want a reviewable change that adopts the recorded live inputs instead of accepting them immediately."
      ],
      notes: [
        "Requires an `out_of_sync` resource and a recorded live input snapshot from drift detection.",
        "If no live snapshot is recorded yet, refresh drift first and retry."
      ],
      nextSteps: [
        "Preview or apply the returned change, or use `opsy resource accept-live <slug> --project <slug>` if you want to adopt the same state immediately without a change."
      ]
    }),
    command({
      id: "resource.restore",
      path: ["resource", "restore"],
      usage: "opsy resource restore <slug> --project <project> --operation <operationId>",
      summary: "Restore a resource to the state captured before an operation."
    }),
    command({
      id: "resource.history",
      path: ["resource", "history"],
      usage: "opsy resource history <slug> --project <project>",
      summary: "List operation history for one resource."
    }),
    command({
      id: "change.list",
      path: ["change", "list"],
      usage: "opsy change list --project <project>",
      summary: "List recent changes in one project.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }),
      examples: [
        "opsy change list --project acme"
      ],
      whenToUse: [
        "Use this when you need an existing change shortId for `change get`, `change preview`, `change append`, or `change apply`."
      ],
      nextSteps: [
        "Run `opsy change get <shortId>` for details on one returned change."
      ]
    }),
    command({
      id: "change.get",
      path: ["change", "get"],
      usage: "opsy change get <shortId>",
      summary: "Get one change with operations.",
      examples: [
        "opsy change get abcd1234"
      ],
      whenToUse: [
        "Use this after `change list` or after a create/apply response gives you a shortId."
      ],
      nextSteps: [
        "Run `opsy change preview <shortId>` to inspect execution details, or `opsy change apply <shortId>` to execute it."
      ]
    }),
    command({
      id: "change.create",
      path: ["change", "create"],
      usage: "opsy change create --project <project> [--mutations <json>] [--summary <text>]",
      summary: "Create a draft change, optionally seeded with mutations.",
      flags: flags({ name: "project", value: "<project>", required: true, description: "Project slug." }, { name: "mutations", value: "<json>", description: "JSON array of mutations to seed the draft." }, { name: "summary", value: "<text>", description: "Optional human summary for the change." }),
      examples: [
        'opsy change create --project acme --summary "Create base network"',
        `opsy change create --project acme --mutations '[{"kind":"create","slug":"network","type":"group"},{"kind":"create","slug":"vpc","type":"aws:ec2/vpc:Vpc","parent":"network","inputs":{"cidrBlock":"10.0.0.0/16"}}]' --summary "Create grouped network"`,
        `opsy change create --project acme --mutations '[{"kind":"update","slug":"subnet-a","parent":"vpc-b","inputs":{}}]' --summary "Move subnet under new parent"`,
        `opsy change create --project acme --mutations '[{"kind":"update","slug":"policy","dependsOn":["public-access-block"],"inputs":{}}]' --summary "Make policy wait for public access block"`,
        `opsy change create --project acme --mutations '[{"kind":"forget","slug":"bucket"}]' --summary "Forget stale bucket state"`,
        `opsy change create --project acme --mutations '[{"kind":"forget","slug":"provider","targetDependents":true}]' --summary "Forget provider and dependents from Opsy state"`,
        `opsy change create --project acme --mutations '[{"kind":"create","slug":"bucket","type":"aws:s3/bucket:Bucket","inputs":{"bucket":"demo"},"customTimeouts":{"create":"30m","delete":"10m"}}]' --summary "Create bucket with custom timeouts"`
      ],
      whenToUse: [
        "Use this when you want a reviewable draft before applying mutations, especially when the work spans multiple resources."
      ],
      notes: [
        'Every mutation object must include `"kind"`. Supported kinds are `"create"`, `"update"`, `"delete"`, `"import"`, and `"forget"`.',
        'In mutation JSON, use `"parent":"<slug>"` to organize resources under another resource.',
        'Use `"dependsOn":["<slug>"]` in mutation JSON for explicit dependency ordering when no input ref expresses the dependency.',
        'Use `"targetDependents":true` only on `"forget"` when you intend state-only removal to cascade from the requested root to graph dependents.',
        'Use `"customTimeouts"` for Pulumi-style operation timeouts. `create`, `update`, and `import` mutations can set `create`/`update`/`delete`; `delete` mutations can override only `"delete"`; `forget` does not support `customTimeouts`.',
        'If you want a folder-like container with no cloud object, create a virtual resource with `type:"group"` first, then parent resources under it.'
      ],
      nextSteps: [
        "Run `opsy change append <shortId> --mutations <json>` to add more work.",
        "Run `opsy change preview <shortId>` to inspect the plan.",
        "Run `opsy change apply <shortId>` when the draft is ready."
      ]
    }),
    command({
      id: "change.append",
      path: ["change", "append"],
      usage: "opsy change append <shortId> --mutations <json> [--summary <text>]",
      summary: "Append mutations to an existing open change.",
      flags: flags({ name: "mutations", value: "<json>", required: true, description: "JSON array of mutations to append." }, { name: "summary", value: "<text>", description: "Optional summary override." }),
      examples: [
        `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"vpc","inputs":{"enableDnsHostnames":true}}]'`,
        `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"subnet-a","parent":"network","inputs":{}}]'`,
        `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"policy","dependsOn":["public-access-block"],"inputs":{}}]'`,
        `opsy change append abcd1234 --mutations '[{"kind":"forget","slug":"bucket","targetDependents":true}]'`,
        `opsy change append abcd1234 --mutations '[{"kind":"update","slug":"bucket","inputs":{"tags":{"env":"prod"}},"customTimeouts":{"update":"45m"}}]'`
      ],
      whenToUse: [
        "Use this after `change create` when you are building up a staged change in multiple steps."
      ],
      notes: [
        'Every mutation object must include `"kind"`. Supported kinds are `"create"`, `"update"`, `"delete"`, `"import"`, and `"forget"`.',
        'Mutation JSON uses `"parent":"<slug>"` for reparenting.',
        'Mutation JSON uses `"dependsOn":["<slug>"]` for explicit dependency ordering when no input ref expresses the dependency.',
        'Mutation JSON uses `"targetDependents":true` only for `"forget"` to cascade state-only removal from the requested root to graph dependents.',
        'Mutation JSON also supports `"customTimeouts"` with the same rules: full policy for `create`/`update`/`import`, delete-only override for `delete`, unsupported for `forget`.'
      ],
      nextSteps: [
        "Run `opsy change preview <shortId>` to inspect the updated draft.",
        "Run `opsy change apply <shortId>` when the change is ready."
      ]
    }),
    command({
      id: "change.preview",
      path: ["change", "preview"],
      usage: "opsy change preview <shortId>",
      summary: "Preview a change.",
      examples: [
        "opsy change preview abcd1234"
      ],
      whenToUse: [
        "Use this before apply when you want to inspect the planned operations and dependencies."
      ],
      nextSteps: [
        "Run `opsy change apply <shortId>` if the preview is acceptable."
      ]
    }),
    command({
      id: "change.apply",
      path: ["change", "apply"],
      usage: "opsy change apply <shortId>",
      summary: "Apply a change.",
      examples: [
        "opsy change apply abcd1234"
      ],
      whenToUse: [
        "Use this after you have created or previewed a change and want Opsy to execute it."
      ],
      notes: [
        "If approval is required, the apply does not complete through MCP. Ask a human to open the returned review URL in the Opsy web UI and approve it there."
      ],
      nextSteps: [
        "If approval is required, stop and ask a human to open the returned review URL in the Opsy web UI and approve it there. Otherwise inspect the resulting change with `opsy change get <shortId>`."
      ]
    }),
    command({
      id: "change.cancel",
      path: ["change", "cancel"],
      usage: "opsy change cancel <shortId> [--reason <text>]",
      summary: "Cancel the active apply execution for one change.",
      flags: flags({ name: "reason", value: "<text>", description: "Optional cancellation reason." }),
      examples: [
        "opsy change cancel abcd1234",
        'opsy change cancel abcd1234 --reason "Manual rollback requested"'
      ],
      whenToUse: [
        "Use this compatibility path when you know the change shortId but not the execution id."
      ],
      nextSteps: [
        "Run `opsy change get <shortId>` to confirm cancellation progress and inspect the latest execution record."
      ]
    }),
    command({
      id: "change.discard",
      path: ["change", "discard"],
      usage: "opsy change discard <shortId>",
      summary: "Discard a change. `dismiss` is an alias."
    }),
    command({
      id: "change.retry",
      path: ["change", "retry"],
      usage: "opsy change retry <shortId>",
      summary: "Retry a failed change."
    }),
    command({
      id: "execution.cancel",
      path: ["execution", "cancel"],
      usage: "opsy execution cancel <executionId> [--reason <text>]",
      summary: "Cancel one running execution by execution id.",
      flags: flags({ name: "reason", value: "<text>", description: "Optional cancellation reason." }),
      examples: [
        "opsy execution cancel 00000000-0000-0000-0000-000000000000"
      ],
      whenToUse: [
        "Use this as the primary control-plane cancel path when you already have an execution id from a change detail or execution record."
      ],
      nextSteps: [
        "Re-run `opsy change get <shortId>` or inspect the web UI change page to confirm cancellation progress."
      ]
    }),
    command({
      id: "integration.list",
      path: ["integration", "list"],
      usage: "opsy integration list",
      summary: "List integrations."
    }),
    command({
      id: "integration.get",
      path: ["integration", "get"],
      usage: "opsy integration get <id>",
      summary: "Get one integration."
    }),
    command({
      id: "integration.create",
      path: ["integration", "create"],
      usage: "opsy integration create --provider <provider> --name <name> --config <json>",
      summary: "Create an integration."
    }),
    command({
      id: "schema.list",
      path: ["schema", "list"],
      usage: "opsy schema list --provider <provider> [--query <text>]",
      summary: "List resource schemas for one provider.",
      flags: flags({ name: "provider", value: "<provider>", required: true, description: "Provider package, for example `aws` or `cloudflare`." }, { name: "query", value: "<text>", description: "Optional filter on the resource token." }),
      examples: [
        "opsy schema list --provider cloudflare --query zone",
        "opsy schema list --provider aws --query vpc"
      ],
      whenToUse: [
        "Use this only when you need help finding the exact type token before creating or updating a resource."
      ],
      nextSteps: [
        "Run `opsy schema get <type-token>` only if field names, nested shape, or required references are still unclear."
      ]
    }),
    command({
      id: "schema.get",
      path: ["schema", "get"],
      usage: "opsy schema get <type-token> [--detailed]",
      summary: "Show compact field types for one resource schema. Use --detailed only when compact output is insufficient.",
      flags: flags({ name: "detailed", description: "Return nested Pulumi/provider schema shape for this type instead of the compact flattened map." }),
      examples: [
        "opsy schema get cloudflare:index/zone:Zone",
        "opsy schema get aws:ec2/vpc:Vpc",
        "opsy schema get aws:cloudfront/distribution:Distribution --detailed"
      ],
      whenToUse: [
        "Use this after `schema list` only when field names, field types, nested shape, or required references are uncertain.",
        "Prefer known Pulumi syntax first when the shape is already obvious."
      ],
      notes: [
        "Schema responses come from Pulumi/provider metadata, not curated Opsy examples.",
        "Compact mode is the default because full nested schemas can be large. Use `--detailed` only when the compact map is insufficient."
      ],
      nextSteps: [
        "Return to `opsy resource create ... --type <type-token>` or `opsy change create ... --mutations <json>` with the schema details in hand."
      ]
    }),
    command({
      id: "observability.aws.logs.groups",
      path: ["observability", "aws", "logs", "groups"],
      usage: "opsy observability aws logs groups --project <project> [...]",
      summary: "List CloudWatch log groups."
    }),
    command({
      id: "observability.aws.logs.tail",
      path: ["observability", "aws", "logs", "tail"],
      usage: "opsy observability aws logs tail --project <project> --log-group <name> [...]",
      summary: "Tail CloudWatch log events."
    }),
    command({
      id: "observability.aws.logs.events",
      path: ["observability", "aws", "logs", "events"],
      usage: "opsy observability aws logs events --project <project> --log-group <name> [...]",
      summary: "List CloudWatch log events."
    }),
    command({
      id: "observability.aws.logs.query",
      path: ["observability", "aws", "logs", "query"],
      usage: "opsy observability aws logs query --project <project> --log-groups <csv> --query-string <query> [...]",
      summary: "Run a CloudWatch Logs Insights query."
    }),
    command({
      id: "observability.aws.metrics.list",
      path: ["observability", "aws", "metrics", "list"],
      usage: "opsy observability aws metrics list --project <project> [...]",
      summary: "List CloudWatch metrics."
    }),
    command({
      id: "observability.aws.metrics.query",
      path: ["observability", "aws", "metrics", "query"],
      usage: "opsy observability aws metrics query --project <project> --queries <json> [...]",
      summary: "Run CloudWatch metric queries."
    }),
    command({
      id: "observability.aws.alarms.list",
      path: ["observability", "aws", "alarms", "list"],
      usage: "opsy observability aws alarms list --project <project> [...]",
      summary: "List CloudWatch alarms."
    }),
    command({
      id: "observability.aws.alarms.detail",
      path: ["observability", "aws", "alarms", "detail"],
      usage: "opsy observability aws alarms detail --project <project> --alarm-name <name>",
      summary: "Get one CloudWatch alarm."
    }),
    command({
      id: "observability.aws.alarms.history",
      path: ["observability", "aws", "alarms", "history"],
      usage: "opsy observability aws alarms history --project <project> --alarm-name <name> [...]",
      summary: "List CloudWatch alarm history."
    }),
    command({
      id: "feedback.send",
      path: ["feedback", "send"],
      usage: "opsy feedback send --message <text> [--error-context <json>] [--from-llm]",
      summary: "Submit feedback to the Opsy team."
    }),
    command({
      id: "auth.login",
      path: ["auth", "login"],
      usage: "opsy auth login --token <token> [--api-url <url>]",
      summary: "Store CLI credentials.",
      flags: flags({ name: "token", value: "<token>", required: true, description: "Personal access token." }, { name: "api-url", value: "<url>", description: "Optional API base URL." }),
      examples: [
        "opsy auth login --token <pat>"
      ],
      whenToUse: [
        "CLI only. Run this before the first CLI command unless you already pass `--token` or `OPSY_TOKEN` on each call."
      ],
      nextSteps: [
        "Run `opsy project list` to begin explicit project discovery."
      ]
    }),
    command({
      id: "auth.logout",
      path: ["auth", "logout"],
      usage: "opsy auth logout",
      summary: "Clear stored CLI credentials."
    }),
    command({
      id: "auth.whoami",
      path: ["auth", "whoami"],
      usage: "opsy auth whoami",
      summary: "Show the current authenticated actor."
    })
  ];
  TOP_LEVEL_HELP = [
    "Opsy manages infrastructure as explicit projects, resources, and changes.",
    "",
    "First-run workflow:",
    "  1. `opsy auth login --token <pat>`",
    "  2. `opsy project list`",
    "  3. `opsy resource list --project <slug>`",
    "  4. `opsy resource get <slug> --project <slug>`",
    "  5. `opsy change create ...` or `opsy resource create ...`",
    "",
    "Read-first safety rule:",
    "  Start with discovery and inspection before mutation. Read the tree, inspect one resource, then mutate.",
    "",
    "Resource traversal:",
    "  `opsy resource list --project <slug>` returns root resources first.",
    "  Add `--parent <slug>` to walk down the tree one level at a time.",
    "",
    "Mutation paths:",
    "  Use `opsy change create` for reviewable drafts and multi-step work.",
    "  Use `opsy resource create`, `opsy resource update`, or `opsy resource delete` for one-off mutations that preview first; pass `--auto-apply` to apply immediately.",
    "  Use `opsy resource forget` for one-off state-only removal that still auto-applies when policy allows.",
    "",
    "Organizing resources:",
    "  Use `--parent <slug>` on `resource create` and `resource update` to place a resource under another resource.",
    "  Use `--depends-on <json>` on `resource create` and `resource update` for explicit dependency ordering in one-off mutations.",
    '  In change mutation JSON, every mutation object must include `"kind"` and must be one of `"create"`, `"update"`, `"delete"`, `"import"`, or `"forget"`. Use `"parent":"<slug>"` for hierarchy, `"dependsOn":["<slug>"]` for explicit dependency ordering, and `"targetDependents":true` only on `"forget"` to cascade state-only removal from the requested root to graph dependents.',
    '  Mutation JSON also supports `"customTimeouts":{"create":"30m","update":"20m","delete":"10m"}` for Pulumi-style operation timeouts on `create`, `update`, and `import`. `delete` mutations can override only `"delete"`. `forget` does not support `customTimeouts`.',
    '  If you want a folder-like container with no cloud object, create a virtual resource with `type:"group"` first, then parent resources under it.',
    "",
    "More help:",
    "  `opsy <noun> --help`",
    "  `opsy <noun> <action> --help`",
    "",
    "Nouns:",
    "  auth           CLI authentication",
    "  project        Projects",
    "  resource       Managed resources and resource lifecycle actions",
    "  change         Proposed and applied changes",
    "  integration    Integrations",
    "  schema         Resource schema browsing",
    "  observability  Provider-scoped logs, metrics, and alarms",
    "  feedback       Submit feedback to the Opsy team"
  ].join(`
`);
});

// ../contracts/display.ts
var init_display = () => {};

// ../contracts/streaming.ts
function createParserState() {
  return {
    eventType: "",
    dataLines: []
  };
}
function extractLine(buffer) {
  for (let index = 0;index < buffer.length; index += 1) {
    const char = buffer[index];
    if (char !== `
` && char !== "\r") {
      continue;
    }
    const nextIndex = char === "\r" && buffer[index + 1] === `
` ? index + 2 : index + 1;
    return {
      line: buffer.slice(0, index),
      rest: buffer.slice(nextIndex)
    };
  }
  return null;
}
function createSseParser(onEvent) {
  let buffer = "";
  let state = createParserState();
  const dispatch = async () => {
    if (state.dataLines.length === 0) {
      state = createParserState();
      return;
    }
    const message = {
      event: state.eventType || "message",
      data: state.dataLines.join(`
`)
    };
    if (state.lastEventId !== undefined) {
      message.id = state.lastEventId;
    }
    if (state.retry !== undefined) {
      message.retry = state.retry;
    }
    state = createParserState();
    await onEvent(message);
  };
  return {
    async push(chunk) {
      buffer += chunk;
      while (true) {
        const next = extractLine(buffer);
        if (!next) {
          return;
        }
        buffer = next.rest;
        const line = next.line;
        if (line === "") {
          await dispatch();
          continue;
        }
        if (line.startsWith(":")) {
          continue;
        }
        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const rawValue = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
        if (field === "event") {
          state.eventType = rawValue;
          continue;
        }
        if (field === "data") {
          state.dataLines.push(rawValue);
          continue;
        }
        if (field === "id") {
          if (!rawValue.includes("\x00")) {
            state.lastEventId = rawValue;
          }
          continue;
        }
        if (field === "retry") {
          const retry = Number.parseInt(rawValue, 10);
          if (Number.isFinite(retry)) {
            state.retry = retry;
          }
        }
      }
    },
    async finish() {
      buffer = "";
      state = createParserState();
    }
  };
}
async function* parseSseStream(stream, signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder;
  const queue = [];
  const parser = createSseParser((event) => {
    queue.push(event);
  });
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await parser.push(decoder.decode(value, { stream: true }));
      while (queue.length > 0) {
        yield queue.shift();
      }
    }
  } finally {
    await parser.finish();
    reader.releaseLock();
  }
}
function mergeHeaders(...sources) {
  const headers = new Headers;
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const next = new Headers(source);
    next.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}
function delay(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
async function* fetchSse(options) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetch is not available.");
  }
  const maxSeenEventIds = options.maxSeenEventIds ?? 512;
  const seenEventIds = new Set;
  const seenEventIdQueue = [];
  const highestSequenceByStream = new Map;
  let lastEventId = options.lastEventId ?? null;
  const reconnect = options.reconnect ?? true;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1000;
  while (!options.signal?.aborted) {
    const headers = mergeHeaders(options.init?.headers, { Accept: "text/event-stream" });
    if (lastEventId) {
      headers.set("Last-Event-ID", lastEventId);
    }
    const response = await fetchImpl(options.url, {
      ...options.init,
      headers,
      signal: options.signal
    });
    if (!response.ok) {
      throw new Error(`SSE response ${response.status}`);
    }
    if (!response.body) {
      throw new Error("SSE response has no body.");
    }
    for await (const event of parseSseStream(response.body, options.signal)) {
      if (event.id) {
        lastEventId = event.id;
        const separator = event.id.lastIndexOf(":");
        const streamId = separator > 0 ? event.id.slice(0, separator) : null;
        const sequenceText = separator > 0 ? event.id.slice(separator + 1) : null;
        if (streamId && sequenceText && /^\d+$/.test(sequenceText)) {
          const sequence = Number.parseInt(sequenceText, 10);
          if (sequence <= (highestSequenceByStream.get(streamId) ?? 0)) {
            continue;
          }
          highestSequenceByStream.set(streamId, sequence);
        } else {
          if (seenEventIds.has(event.id)) {
            continue;
          }
          seenEventIds.add(event.id);
          seenEventIdQueue.push(event.id);
          if (seenEventIdQueue.length > maxSeenEventIds) {
            const evictedId = seenEventIdQueue.shift();
            if (evictedId) {
              seenEventIds.delete(evictedId);
            }
          }
        }
      }
      yield event;
    }
    if (!reconnect || options.signal?.aborted) {
      return;
    }
    await delay(reconnectDelayMs, options.signal);
  }
}

// ../contracts/audit.ts
var ORG_AUDIT_EVENTS, ORG_AUDIT_EVENT_TYPES, ORG_AUDIT_ENTITY_TYPES;
var init_audit = __esm(() => {
  ORG_AUDIT_EVENTS = [
    { eventType: "project.created", entityType: "project", label: "Project created", dot: "bg-cyan-500" },
    { eventType: "project.updated", entityType: "project", label: "Project updated", dot: "bg-cyan-500" },
    { eventType: "project.deleted", entityType: "project", label: "Project deleted", dot: "bg-cyan-500" },
    { eventType: "integration.created", entityType: "integration", label: "Integration created", dot: "bg-indigo-500" },
    { eventType: "integration.updated", entityType: "integration", label: "Integration updated", dot: "bg-indigo-500" },
    { eventType: "integration.deleted", entityType: "integration", label: "Integration deleted", dot: "bg-indigo-500" },
    { eventType: "integration.tested", entityType: "integration", label: "Integration tested", dot: "bg-indigo-500" },
    { eventType: "change.proposed", entityType: "change", label: "Change proposed", dot: "bg-blue-500" },
    { eventType: "change.applied", entityType: "change", label: "Change applied", dot: "bg-green-500" },
    { eventType: "change.dismissed", entityType: "change", label: "Change dismissed", dot: "bg-muted-foreground" },
    { eventType: "resource.conflict_detected", entityType: "resource", label: "Conflict detected", dot: "bg-amber-500" },
    { eventType: "pat.created", entityType: "personal_access_token", label: "PAT created", dot: "bg-indigo-500" },
    { eventType: "pat.revoked", entityType: "personal_access_token", label: "PAT revoked", dot: "bg-red-500" },
    { eventType: "agent_token.created", entityType: "agent_access_token", label: "Agent token created", dot: "bg-sky-500" },
    { eventType: "agent_token.revoked", entityType: "agent_access_token", label: "Agent token revoked", dot: "bg-rose-500" },
    { eventType: "agent.created", entityType: "agent", label: "Agent created", dot: "bg-violet-500" },
    { eventType: "agent.updated", entityType: "agent", label: "Agent updated", dot: "bg-violet-500" },
    { eventType: "agent.deleted", entityType: "agent", label: "Agent deleted", dot: "bg-violet-500" }
  ];
  ORG_AUDIT_EVENT_TYPES = new Set(ORG_AUDIT_EVENTS.map((e) => e.eventType));
  ORG_AUDIT_ENTITY_TYPES = [...new Set(ORG_AUDIT_EVENTS.map((e) => e.entityType))];
});

// ../contracts/legal.ts
var init_legal = () => {};

// ../contracts/index.ts
var init_contracts = __esm(() => {
  init_observe();
  init_commands();
  init_display();
  init_audit();
  init_legal();
});

// src/client.ts
var exports_client = {};
__export(exports_client, {
  apiStream: () => apiStream,
  apiRequest: () => apiRequest,
  ApiRequestError: () => ApiRequestError
});
async function apiRequest(path, opts) {
  const url = `${opts.apiUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${opts.token}`
  };
  let requestBody;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body: requestBody, signal: opts.signal });
  if (res.status === 204)
    return;
  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, json);
  }
  return json;
}
async function* apiStream(path, opts) {
  const url = `${opts.apiUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "text/event-stream"
  };
  let body;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  for await (const event of fetchSse({
    url,
    signal: opts.signal,
    lastEventId: opts.lastEventId,
    reconnect: opts.reconnect ?? true,
    init: {
      method: opts.method ?? "GET",
      headers,
      body
    }
  })) {
    yield event;
  }
}
var ApiRequestError;
var init_client = __esm(() => {
  init_contracts();
  ApiRequestError = class ApiRequestError extends Error {
    status;
    code;
    retryable;
    details;
    body;
    constructor(status, body) {
      const payload = body ?? {};
      super(payload.message ?? `HTTP ${status}`);
      this.name = "ApiRequestError";
      this.status = status;
      this.code = payload.code;
      this.retryable = payload.retryable ?? false;
      this.details = payload.details;
      this.body = body;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  };
});

// src/bin.ts
import { readFileSync as readFileSync2 } from "node:fs";

// ../../node_modules/.bun/commander@13.1.0/node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

// src/commands/auth.ts
init_config();
var authCmd = new Command("auth").description("Authentication");
authCmd.command("login").description("Store API token for CLI access").requiredOption("--token <token>", "Personal Access Token").option("--api-url <url>", "API URL").action((opts) => {
  const config = loadConfig();
  config.token = opts.token;
  if (opts.apiUrl)
    config.apiUrl = opts.apiUrl;
  saveConfig(config);
  console.log("Credentials saved to ~/.opsy/config.json");
});
authCmd.command("logout").description("Clear stored credentials").action(() => {
  saveConfig({});
  console.log("Credentials cleared.");
});
authCmd.command("whoami").description("Show current user").action(async function() {
  const { getToken: getToken2, getApiUrl: getApiUrl2 } = await Promise.resolve().then(() => (init_config(), exports_config));
  const { apiRequest: apiRequest2 } = await Promise.resolve().then(() => (init_client(), exports_client));
  const root = this.parent.parent;
  const flags2 = root.opts();
  const token = getToken2(flags2);
  const apiUrl = getApiUrl2(flags2);
  try {
    const res = await apiRequest2("/auth/whoami", { token, apiUrl });
    if (flags2.json) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`User: ${res.user?.firstName ?? ""} ${res.user?.lastName ?? ""} (${res.actor?.userId})`);
      console.log(`Org:  ${res.actor?.orgId}`);
      console.log(`Auth: ${res.actor?.authType}`);
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/bin.ts
init_contracts();

// src/commands/common.ts
init_contracts();
init_client();
init_config();
init_client();
var defaultCliDeps = {
  apiRequest,
  apiStream,
  getToken,
  getApiUrl,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code)
};
function getRootFlags(command2) {
  let current = command2;
  while (current.parent)
    current = current.parent;
  return current.opts();
}
function handleCliError(error, deps) {
  let message = error instanceof Error ? error.message : String(error);
  if (error instanceof ApiRequestError) {
    message = error.code ? `${error.code}: ${error.message}` : error.message;
  }
  deps.error(`Error: ${renderCommandErrorMessage(message)}`);
  return deps.exit(1);
}
function requireOptionValue(value, name) {
  if (!value) {
    throw new Error(`Missing --${name}.`);
  }
  return value;
}
function requireArgumentValue(value, label) {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}
function parseJsonFlag(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON in --${label}.`);
  }
}
function resolveProjectValue(command2, value) {
  const rootFlags = getRootFlags(command2);
  return getProject({
    project: value ?? rootFlags.project
  });
}
function requireProjectValue(command2, value) {
  return requireOptionValue(resolveProjectValue(command2, value), "project");
}
function addSharedHelp(command2, path) {
  const spec = findCommandSpec(path);
  if (!spec) {
    return command2;
  }
  const usageTail = spec.usage.split(" ").slice(path.length + 1).join(" ");
  if (usageTail) {
    command2.usage(usageTail);
  }
  if (spec.examples?.length || spec.notes?.length || spec.flags?.length || spec.whenToUse?.length || spec.nextSteps?.length) {
    const flags2 = spec.flags?.length ? `
Flags:
${spec.flags.map((flag) => {
      const value = flag.value ? ` ${flag.value}` : "";
      const required = flag.required ? " (required)" : "";
      return `  --${flag.name}${value}${required}  ${flag.description}`;
    }).join(`
`)}` : "";
    const whenToUse = spec.whenToUse?.length ? `
When to use:
${spec.whenToUse.map((line) => `  ${line}`).join(`
`)}` : "";
    const notes = spec.notes?.length ? `
Notes:
${spec.notes.map((note) => `  ${note}`).join(`
`)}` : "";
    const examples = spec.examples?.length ? `
Examples:
${spec.examples.map((example) => `  ${example}`).join(`
`)}` : "";
    const nextSteps = spec.nextSteps?.length ? `
What to do next:
${spec.nextSteps.map((line) => `  ${line}`).join(`
`)}` : "";
    command2.addHelpText("after", `
Usage:
  ${spec.usage}${flags2}${whenToUse}${examples}${notes}${nextSteps}`);
  }
  return command2;
}
function buildQuery(params) {
  const search = new URLSearchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value)
      search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// src/output.ts
function formatTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const head = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const body = rows.map((r) => r.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ")).join(`
`);
  return `${head}
${sep}
${body}`;
}
function output(data, flags2) {
  if (flags2.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (flags2.quiet) {
    if (typeof data === "string")
      console.log(data);
    else if (data && typeof data === "object" && "id" in data)
      console.log(data.id);
    else if (data && typeof data === "object" && "shortId" in data)
      console.log(data.shortId);
  } else {
    console.log(data);
  }
}

// src/commands/project.ts
function createProjectCommand(deps = defaultCliDeps) {
  const projectCmd = new Command("project").description("List, get, and create projects");
  addSharedHelp(projectCmd.command("list").description("List projects").action(async function() {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const projects = await deps.apiRequest("/projects", { token, apiUrl });
      if (flags2.json)
        return output(projects, flags2);
      if (!projects.length)
        return deps.log("No projects found.");
      deps.log(formatTable(["SLUG", "NAME", "CREATED"], projects.map((project) => [project.slug, project.name, new Date(project.createdAt).toLocaleDateString()])));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["project", "list"]);
  addSharedHelp(projectCmd.command("get").description("Get one project").argument("[slug]").action(async function(slug) {
    const flags2 = getRootFlags(this);
    try {
      if (!slug) {
        throw new Error("Missing project slug.");
      }
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/projects/${slug}`, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["project", "get"]);
  addSharedHelp(projectCmd.command("create").description("Create a project").option("--slug <slug>", "Project slug").option("--name <name>", "Project name").option("--auto-apply-policy <policy>", "Auto-apply policy (disabled, creates_and_imports, non_destructive, all)").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      if (!opts.slug) {
        throw new Error("Missing --slug.");
      }
      if (!opts.name) {
        throw new Error("Missing --name.");
      }
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest("/projects", {
        method: "POST",
        body: { slug: opts.slug, name: opts.name, autoApplyPolicy: opts.autoApplyPolicy },
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["project", "create"]);
  return projectCmd;
}
var projectCmd = createProjectCommand();

// src/display.ts
function formatUnknown(value) {
  if (value === null || value === undefined)
    return "-";
  if (typeof value === "string")
    return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}
function formatRelative(iso) {
  if (!iso)
    return "-";
  const delta = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60)
    return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function renderHeader(label, value) {
  return `${(label + " ").padEnd(10)}${value}`;
}
function displayChangeStatus(status, approvalRequired) {
  return approvalRequired ? "awaiting_approval" : status;
}
function formatCountSummary(summary) {
  const parts = Object.entries(summary).filter(([, value]) => value > 0).map(([key, value]) => `${key}:${value}`);
  return parts.join(" ") || "-";
}
function renderValueRows(title, rows) {
  if (rows.length === 0)
    return "";
  const lines = [title];
  for (const row of rows) {
    if (row.template) {
      const resolved = row.resolved !== undefined ? ` -> ${formatUnknown(row.resolved)}` : "";
      lines.push(`- ${row.path}: ${row.template}${resolved}`);
    } else {
      lines.push(`- ${row.path}: ${formatUnknown(row.value)}`);
    }
  }
  return lines.join(`
`);
}
function renderDeltaRows(title, rows) {
  if (rows.length === 0)
    return "";
  const lines = [title];
  for (const row of rows) {
    lines.push(`- ${row.path}: ${formatUnknown(row.before)} -> ${formatUnknown(row.after)}`);
  }
  return lines.join(`
`);
}
function renderResourceSummaryTable(rows) {
  return formatTable(["SLUG", "KIND", "TYPE", "STATUS", "PARENT", "CHILDREN", "ID"], rows.map((row) => [
    row.slug,
    row.kind,
    row.type,
    row.status,
    row.parentSlug ?? "-",
    String(row.childCount),
    row.providerId ?? "-"
  ]));
}
function renderChangeSummaryTable(rows) {
  return formatTable(["SHORT ID", "STATUS", "SUMMARY", "OPS", "PREVIEW", "CREATED"], rows.map((row) => [
    row.shortId,
    displayChangeStatus(row.status, row.approvalRequired),
    row.summary ?? "-",
    String(row.operationCount),
    formatCountSummary(row.previewSummary),
    formatRelative(row.createdAt)
  ]));
}
function renderResourceDetail(view) {
  const sections = [
    renderHeader("Resource", view.resource.slug),
    renderHeader("Type", view.resource.type),
    renderHeader("Status", view.resource.syncState === "in_sync" ? view.resource.status : `${view.resource.status} (${view.resource.syncState})`),
    renderHeader("ID", view.resource.providerId ?? "-"),
    ...view.resource.dependsOn.length > 0 ? [renderHeader("DependsOn", view.resource.dependsOn.join(", "))] : [],
    "",
    renderValueRows("Intent", view.intent)
  ];
  if (view.problem.length > 0) {
    sections.push("", renderDeltaRows("Problem", view.problem));
  }
  if (view.outcome) {
    const outcome = [`Outcome`, `- ${view.outcome.kind} ${view.outcome.status}${view.outcome.changeShortId ? ` (${view.outcome.changeShortId})` : ""}`];
    if (view.outcome.error?.message)
      outcome.push(`- ${view.outcome.error.message}`);
    sections.push("", outcome.join(`
`));
  }
  return sections.filter(Boolean).join(`
`);
}
function renderResourceDiff(view) {
  const sections = [
    renderHeader("Resource", view.resource.slug),
    renderHeader("Type", view.resource.type),
    renderHeader("Status", view.resource.status),
    renderHeader("ID", view.resource.providerId ?? "-"),
    "",
    view.delta.length > 0 ? renderDeltaRows("Delta", view.delta) : `Delta
- no differences`
  ];
  if (view.outcome?.message) {
    sections.push("", `Outcome
- live read failed: ${view.outcome.message}`);
  }
  return sections.join(`
`);
}
function renderResourceHistoryTable(rows) {
  return formatTable(["WHEN", "KIND", "STATUS", "CHANGE", "OP ID", "MESSAGE"], rows.map((row) => [
    formatRelative(row.when),
    row.kind,
    row.status,
    row.changeShortId ?? "-",
    row.operationId,
    row.message ?? "-"
  ]));
}
function renderChangeDetail(view) {
  const lines = [
    renderHeader("Change", view.change.shortId),
    renderHeader("Status", displayChangeStatus(view.change.status, view.change.approvalRequired)),
    renderHeader("Summary", view.change.summary ?? "-")
  ];
  const preview = formatCountSummary(view.change.previewSummary);
  if (preview !== "-")
    lines.push(renderHeader("Preview", preview));
  if (view.change.warnings.length > 0) {
    lines.push("");
    for (const warning of view.change.warnings) {
      lines.push(`Warning: ${warning}`);
    }
  }
  lines.push(renderHeader("Failed", String(view.change.counts.failed)), renderHeader("Blocked", String(view.change.counts.blocked)), renderHeader("Succeeded", String(view.change.counts.succeeded)), "", "Operations");
  for (const operation of view.operations) {
    lines.push(`- ${operation.slug.padEnd(15)} ${operation.kind.padEnd(8)} ${operation.status}`);
    if (operation.blockedBy.length > 0) {
      lines.push(`  blocked by: ${operation.blockedBy.join(", ")}`);
    } else if (operation.error?.message) {
      lines.push(`  error: ${operation.error.message}`);
    }
    if (operation.dependsOn.length > 0) {
      lines.push(`  depends on: ${operation.dependsOn.join(", ")}`);
    }
  }
  return lines.join(`
`);
}
function renderApplyProgress(view) {
  const lines = [
    renderHeader("Applying", view.change.shortId),
    renderHeader("Summary", view.change.summary ?? "-"),
    "",
    "Operations"
  ];
  for (const operation of view.operations) {
    lines.push(`- ${operation.slug.padEnd(15)} ${operation.kind.padEnd(8)} ${operation.status}`);
    if (operation.blockedBy.length > 0) {
      lines.push(`  blocked by: ${operation.blockedBy.join(", ")}`);
    } else if (operation.error?.message) {
      lines.push(`  error: ${operation.error.message}`);
    }
  }
  lines.push("", "Result", `Status: ${view.change.status}`, `Failed: ${view.counts.failed}`, `Blocked: ${view.counts.blocked}`, `Succeeded: ${view.counts.succeeded}`);
  return lines.join(`
`);
}

// src/commands/resource.ts
async function fetchChangeDetailView(deps, shortId, flags2) {
  const token = deps.getToken(flags2);
  const apiUrl = deps.getApiUrl(flags2);
  return deps.apiRequest(`/changes/${shortId}`, { token, apiUrl });
}
function createResourceCommand(deps = defaultCliDeps) {
  const resourceCmd = new Command("resource").description("List, inspect, and mutate resources");
  addSharedHelp(resourceCmd.command("list").description("List resources").option("--project <slug>", "Project slug").option("--parent <slug>", "Parent resource slug").option("--detailed", "Return full resource detail objects").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const path = `/projects/${project}/resources${buildQuery({
        parent: opts.parent,
        view: flags2.json || opts.detailed ? "raw" : undefined
      })}`;
      const resources = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json || opts.detailed)
        return output(resources, flags2);
      if (!resources.length)
        return deps.log("No resources found.");
      deps.log(renderResourceSummaryTable(resources));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "list"]);
  addSharedHelp(resourceCmd.command("get").description("Get one managed Opsy resource record").argument("[slug]").option("--project <slug>", "Project slug").option("--live", "Include live resource comparison").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      if (!opts.live) {
        const path = `/projects/${project}/resources/${resourceSlug}${flags2.json ? buildQuery({ view: "raw" }) : ""}`;
        const data = await deps.apiRequest(path, { token, apiUrl });
        if (flags2.json)
          return output(data, flags2);
        deps.log(renderResourceDetail(data));
        return;
      }
      return output(await deps.apiRequest(`/projects/${project}/resources/read${buildQuery({ slug: resourceSlug })}`, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "get"]);
  addSharedHelp(resourceCmd.command("discover").description("Discover managed and unmanaged provider inventory").option("--project <slug>", "Project slug").option("--provider <provider>", "Provider id (aws or cloudflare)").option("--type <type>", "Optional type filter").option("--profile <profileId>", "Integration profile ID").option("--location <location>", "Location filter").option("--region <region>", "Alias for --location").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const location = opts.location ?? opts.region;
      const path = `/projects/${project}/resources/discover${buildQuery({
        provider: opts.provider,
        type: opts.type,
        profileId: opts.profile,
        location
      })}`;
      output(await deps.apiRequest(path, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "discover"]);
  addSharedHelp(resourceCmd.command("read").description("Read live provider state for a managed slug or external selector").argument("[slug]").option("--project <slug>", "Project slug").option("--type <type>", "External resource type").option("--provider-id <id>", "External provider ID").option("--provider <provider>", "Provider id (aws or cloudflare)").option("--profile <profileId>", "Integration profile ID").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const path = `/projects/${project}/resources/read${buildQuery({
        slug,
        type: opts.type,
        providerId: opts.providerId,
        provider: opts.provider,
        profileId: opts.profile
      })}`;
      output(await deps.apiRequest(path, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "read"]);
  addSharedHelp(resourceCmd.command("import").description("Import an external resource into managed Opsy state").option("--project <slug>", "Project slug").option("--slug <slug>", "Managed resource slug").option("--type <type>", "Resource type").option("--provider-id <id>", "External provider ID").option("--profile <profileId>", "Integration profile ID").option("--summary <text>", "Change summary").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/resources/import`, {
        method: "POST",
        body: {
          slug: requireOptionValue(opts.slug, "slug"),
          type: requireOptionValue(opts.type, "type"),
          providerId: requireOptionValue(opts.providerId, "provider-id"),
          profileId: opts.profile,
          summary: opts.summary
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "import"]);
  addSharedHelp(resourceCmd.command("create").description("Create one resource; preview by default, or pass --auto-apply to apply immediately").option("--project <slug>", "Project slug").option("--slug <slug>", "Resource slug").option("--type <type>", "Resource token").option("--inputs <json>", "Inputs JSON object").option("--parent <slug>", "Parent resource slug").option("--depends-on <json>", "JSON array of dependency slugs").option("--auto-apply", "Apply immediately after preview").option("--summary <text>", "Change summary").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireOptionValue(opts.slug, "slug");
      const type = requireOptionValue(opts.type, "type");
      const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/resources`, {
        method: "POST",
        body: {
          slug: resourceSlug,
          type,
          inputs,
          parent: opts.parent,
          dependsOn: opts.dependsOn ? parseJsonFlag(opts.dependsOn, "depends-on") : undefined,
          autoApply: opts.autoApply === true ? true : undefined,
          summary: opts.summary
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "create"]);
  addSharedHelp(resourceCmd.command("update").description("Update one resource; preview by default, or pass --auto-apply to apply immediately").argument("[slug]").option("--project <slug>", "Project slug").option("--inputs <json>", "Inputs JSON object").option("--summary <text>", "Change summary").option("--remove-input-paths <json>", "JSON array of input paths to remove").option("--parent <slug>", "New parent slug").option("--depends-on <json>", "JSON array of dependency slugs").option("--auto-apply", "Apply immediately after preview").option("--version <n>", "Optimistic-lock version").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const inputs = parseJsonFlag(requireOptionValue(opts.inputs, "inputs"), "inputs");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}`, {
        method: "PUT",
        body: {
          inputs,
          summary: opts.summary,
          removeInputPaths: opts.removeInputPaths ? parseJsonFlag(opts.removeInputPaths, "remove-input-paths") : undefined,
          parent: opts.parent,
          dependsOn: opts.dependsOn ? parseJsonFlag(opts.dependsOn, "depends-on") : undefined,
          autoApply: opts.autoApply === true ? true : undefined,
          version: opts.version ? Number(opts.version) : undefined
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "update"]);
  addSharedHelp(resourceCmd.command("delete").description("Delete one managed resource or one external provider object; preview by default, or pass --auto-apply to apply immediately").argument("[slug]").option("--project <slug>", "Project slug").option("--type <type>", "External resource type").option("--provider-id <id>", "External provider ID").option("--profile <profileId>", "Integration profile ID").option("--recursive", "Delete descendants too").option("--auto-apply", "Apply immediately after preview").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/resources`, {
        method: "DELETE",
        body: slug ? { slug, recursive: opts.recursive, autoApply: opts.autoApply === true ? true : undefined } : {
          type: requireOptionValue(opts.type, "type"),
          providerId: requireOptionValue(opts.providerId, "provider-id"),
          profileId: opts.profile,
          autoApply: opts.autoApply === true ? true : undefined
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "delete"]);
  addSharedHelp(resourceCmd.command("forget").description("Forget one resource from Opsy state and immediately attempt apply").argument("[slug]").option("--project <slug>", "Project slug").option("--recursive", "Forget descendants too").option("--target-dependents", "Forget graph dependents too").option("--summary <text>", "Change summary").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/changes`, {
        method: "POST",
        body: {
          mutations: [{
            kind: "forget",
            slug: resourceSlug,
            recursive: opts.recursive,
            targetDependents: opts.targetDependents
          }],
          summary: opts.summary ?? `Forget ${resourceSlug}`
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "forget"]);
  addSharedHelp(resourceCmd.command("diff").description("Diff one resource").argument("[slug]").option("--project <slug>", "Project slug").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const data = await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/diff${flags2.json ? buildQuery({ view: "raw" }) : ""}`, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      deps.log(renderResourceDiff(data));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "diff"]);
  addSharedHelp(resourceCmd.command("refresh").description("Refresh one resource").argument("[slug]").option("--project <slug>", "Project slug").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/sync`, {
        method: "POST",
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "refresh"]);
  addSharedHelp(resourceCmd.command("accept-live").description("Accept recorded live state into desired inputs immediately").argument("[slug]").option("--project <slug>", "Project slug").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/accept-live`, {
        method: "POST",
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "accept-live"]);
  addSharedHelp(resourceCmd.command("reconcile").description("Promote recorded live state into desired inputs through a change").argument("[slug]").option("--project <slug>", "Project slug").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/promote-current`, {
        method: "POST",
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "reconcile"]);
  addSharedHelp(resourceCmd.command("restore").description("Restore one resource from an operation snapshot").argument("[slug]").option("--project <slug>", "Project slug").option("--operation <id>", "Operation id").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const operation = requireOptionValue(opts.operation, "operation");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/restore`, {
        method: "POST",
        body: { operationId: operation },
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "restore"]);
  addSharedHelp(resourceCmd.command("history").description("List history for one resource").argument("[slug]").option("--project <slug>", "Project slug").action(async function(slug, opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const resourceSlug = requireArgumentValue(slug, "resource slug");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const data = await deps.apiRequest(`/projects/${project}/resources/${resourceSlug}/history${flags2.json ? buildQuery({ view: "raw" }) : ""}`, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      deps.log(renderResourceHistoryTable(data));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["resource", "history"]);
  return resourceCmd;
}
var resourceCmd = createResourceCommand();

// src/commands/change.ts
init_client();
function getExecutionErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return null;
}
function resolveKnownOperationSlug(payload, operationIds, operationsBySlug) {
  const operationId = typeof payload.operationId === "string" ? payload.operationId : null;
  if (operationId) {
    return operationIds.get(operationId) ?? null;
  }
  const resourceSlug = typeof payload.resourceSlug === "string" ? payload.resourceSlug : null;
  if (!resourceSlug || !operationsBySlug.has(resourceSlug)) {
    return null;
  }
  return resourceSlug;
}
async function fetchChangeDetailView2(deps, shortId, flags2) {
  const token = deps.getToken(flags2);
  const apiUrl = deps.getApiUrl(flags2);
  return deps.apiRequest(`/changes/${shortId}`, { token, apiUrl });
}
function createChangeCommand(deps = defaultCliDeps) {
  const changeCmd = new Command("change").description("List, inspect, and execute changes");
  addSharedHelp(changeCmd.command("list").description("List changes").option("--project <slug>", "Project slug").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const response = await deps.apiRequest(`/projects/${project}/changes${flags2.json ? buildQuery({ view: "raw" }) : ""}`, { token, apiUrl });
      if (flags2.json)
        return output(response, flags2);
      if (!response.items.length)
        return deps.log("No changes found.");
      deps.log(renderChangeSummaryTable(response.items));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "list"]);
  addSharedHelp(changeCmd.command("get").description("Get one change").argument("[shortId]").action(async function(shortId) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const path = `/changes/${changeShortId}${flags2.json ? buildQuery({ view: "raw" }) : ""}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      deps.log(renderChangeDetail(data));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "get"]);
  addSharedHelp(changeCmd.command("create").description("Create a change").option("--project <slug>", "Project slug").option("--mutations <json>", "Mutation array").option("--summary <text>", "Change summary").action(async function(opts) {
    const flags2 = getRootFlags(this);
    try {
      const project = requireProjectValue(this, opts.project);
      const body = {};
      if (opts.summary)
        body.summary = opts.summary;
      if (opts.mutations)
        body.mutations = parseJsonFlag(opts.mutations, "mutations");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/projects/${project}/changes`, {
        method: "POST",
        body,
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      if (Array.isArray(body.mutations) && result?.change?.shortId) {
        deps.log(renderChangeDetail(await fetchChangeDetailView2(deps, result.change.shortId, flags2)));
        return;
      }
      output(result, flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "create"]);
  addSharedHelp(changeCmd.command("append").description("Append mutations to one change").argument("[shortId]").option("--mutations <json>", "Mutation array").option("--summary <text>", "Change summary override").action(async function(shortId, opts) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const mutations = parseJsonFlag(requireOptionValue(opts.mutations, "mutations"), "mutations");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const result = await deps.apiRequest(`/changes/${changeShortId}/mutations`, {
        method: "POST",
        body: { mutations, summary: opts.summary },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      deps.log(renderChangeDetail(await fetchChangeDetailView2(deps, changeShortId, flags2)));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "append"]);
  addSharedHelp(changeCmd.command("preview").description("Preview one change").argument("[shortId]").action(async function(shortId) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      const path = `/changes/${changeShortId}/preview${flags2.json ? buildQuery({ view: "raw" }) : ""}`;
      const data = await deps.apiRequest(path, { method: "POST", token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      deps.log(renderChangeDetail(data));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "preview"]);
  addSharedHelp(changeCmd.command("apply").description("Apply one change").argument("[shortId]").action(async function(shortId) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      if (flags2.json) {
        const result = await deps.apiRequest(`/changes/${changeShortId}/apply`, { method: "POST", token, apiUrl });
        return output(result, flags2);
      }
      const initial = await deps.apiRequest(`/changes/${changeShortId}`, { token, apiUrl });
      const opMap = new Map(initial.operations.map((operation) => [operation.slug, {
        slug: operation.slug,
        kind: operation.kind,
        status: operation.status,
        error: operation.error,
        blockedBy: operation.blockedBy
      }]));
      const operationIds = new Map(initial.operations.flatMap((operation) => operation.operationId ? [[operation.operationId, operation.slug]] : []));
      const started = await deps.apiRequest(`/changes/${changeShortId}/apply`, { method: "POST", token, apiUrl });
      if (started.kind === "approval_required") {
        const result = started;
        deps.log(`Human approval required in the Opsy web UI for change ${result.change.shortId}.`);
        deps.log("The change has not been applied yet.");
        deps.log(`Ask a human to open ${result.reviewUrl} and approve it there.`);
        return;
      }
      let finalStatus = initial.change.status;
      for await (const message of (deps.apiStream ?? apiStream)(`/executions/${started.executionId}/events`, {
        token,
        apiUrl,
        reconnect: true
      })) {
        const event = JSON.parse(message.data);
        if (event.type === "operation.started") {
          const slug = resolveKnownOperationSlug(event.payload, operationIds, opMap);
          if (!slug) {
            continue;
          }
          const current = opMap.get(slug);
          const kind = String(event.payload.kind ?? event.payload.op ?? current.kind ?? "unknown");
          current.kind = kind;
          current.status = "running";
          opMap.set(slug, current);
          deps.log(`- ${slug} ${kind} running`);
        } else if (event.type === "operation.completed") {
          const slug = resolveKnownOperationSlug(event.payload, operationIds, opMap);
          if (!slug) {
            continue;
          }
          const current = opMap.get(slug);
          const kind = String(event.payload.kind ?? event.payload.op ?? current.kind ?? "unknown");
          const blockedBy = Array.isArray(event.payload.blockedBy) ? event.payload.blockedBy.filter((value) => typeof value === "string") : [];
          const errorMessage = getExecutionErrorMessage(event.payload.error);
          const error = errorMessage ? { message: errorMessage } : null;
          current.kind = kind;
          current.status = String(event.payload.status ?? "succeeded");
          current.error = error;
          current.blockedBy = blockedBy;
          opMap.set(slug, current);
          const suffix = blockedBy.length > 0 ? ` blocked by: ${blockedBy.join(", ")}` : error?.message ? ` error: ${error.message}` : "";
          deps.log(`- ${slug} ${kind} ${current.status}${suffix}`);
        } else if (event.type === "execution.completed") {
          finalStatus = "applied";
          break;
        } else if (event.type === "execution.cancelled" || event.type === "execution.failed") {
          finalStatus = "failed";
          break;
        }
      }
      const resultView = {
        kind: "change.apply",
        change: {
          shortId: initial.change.shortId,
          status: finalStatus,
          summary: initial.change.summary
        },
        counts: {
          pending: 0,
          running: 0,
          failed: 0,
          blocked: 0,
          succeeded: 0
        },
        operations: []
      };
      const final = renderApplyProgress({
        ...resultView,
        counts: {
          pending: [...opMap.values()].filter((operation) => operation.status === "pending" || operation.status === "planned").length,
          running: [...opMap.values()].filter((operation) => operation.status === "running").length,
          failed: [...opMap.values()].filter((operation) => operation.status === "failed").length,
          blocked: [...opMap.values()].filter((operation) => operation.status === "blocked").length,
          succeeded: [...opMap.values()].filter((operation) => !["pending", "planned", "running", "failed", "blocked"].includes(operation.status)).length
        },
        operations: [...opMap.values()]
      });
      deps.log("");
      deps.log(final);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "apply"]);
  addSharedHelp(changeCmd.command("dismiss").alias("discard").description("Dismiss one preview-only change").argument("[shortId]").action(async function(shortId) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/changes/${changeShortId}/dismiss`, { method: "POST", token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "discard"]);
  addSharedHelp(changeCmd.command("retry").description("Retry one failed change").argument("[shortId]").action(async function(shortId) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/changes/${changeShortId}/retry`, { method: "POST", token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "retry"]);
  addSharedHelp(changeCmd.command("cancel").description("Cancel the active apply execution for one change").argument("[shortId]").option("--reason <text>", "Cancellation reason").action(async function(shortId, opts) {
    const flags2 = getRootFlags(this);
    try {
      const changeShortId = requireArgumentValue(shortId, "change shortId");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/changes/${changeShortId}/cancel`, {
        method: "POST",
        body: { reason: opts.reason },
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["change", "cancel"]);
  return changeCmd;
}
var changeCmd = createChangeCommand();

// src/commands/execution.ts
function createExecutionCommand(deps = defaultCliDeps) {
  const executionCmd = new Command("execution").description("Inspect and control executions");
  addSharedHelp(executionCmd.command("cancel").description("Cancel one running execution").argument("[executionId]").option("--reason <text>", "Cancellation reason").action(async function(executionId, opts) {
    const flags2 = getRootFlags(this);
    try {
      const id = requireArgumentValue(executionId, "execution id");
      const token = deps.getToken(flags2);
      const apiUrl = deps.getApiUrl(flags2);
      output(await deps.apiRequest(`/executions/${id}/cancel`, {
        method: "POST",
        body: { reason: opts.reason },
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["execution", "cancel"]);
  return executionCmd;
}
var executionCmd = createExecutionCommand();

// src/commands/integration.ts
function parseJson(value) {
  return JSON.parse(value);
}
function createIntegrationCommand(deps = defaultCliDeps) {
  const integrationCmd = new Command("integration").description("List, get, and create integrations");
  addSharedHelp(integrationCmd.command("list").description("List integrations").action(async function() {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const integrations = await deps.apiRequest("/integrations", { token, apiUrl });
      if (flags2.json)
        return output(integrations, flags2);
      if (!integrations.length)
        return deps.log("No integrations found.");
      deps.log(formatTable(["ID", "PROVIDER", "NAME"], integrations.map((integration) => [integration.id.slice(0, 8), integration.providerPkg, integration.profileName])));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["integration", "list"]);
  addSharedHelp(integrationCmd.command("get").description("Get one integration").argument("<id>").action(async function(id) {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      output(await deps.apiRequest(`/integrations/${id}`, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["integration", "get"]);
  addSharedHelp(integrationCmd.command("create").description("Create an integration").requiredOption("--provider <pkg>", "Provider package").requiredOption("--name <name>", "Integration name").requiredOption("--config <json>", "Provider config JSON").action(async function(opts) {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      output(await deps.apiRequest("/integrations", {
        method: "POST",
        body: { providerPkg: opts.provider, profileName: opts.name, config: parseJson(opts.config) },
        token,
        apiUrl
      }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["integration", "create"]);
  return integrationCmd;
}
var integrationCmd = createIntegrationCommand();

// src/commands/schema.ts
function createSchemaCommand(deps = defaultCliDeps) {
  const schemaCmd = new Command("schema").description("List and inspect resource schemas");
  addSharedHelp(schemaCmd.command("list").description("List resource schemas for a provider").requiredOption("--provider <pkg>", "Provider package").option("--query <text>", "Filter query").action(async function(opts) {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const result = await deps.apiRequest(`/schemas/types?provider=${encodeURIComponent(opts.provider)}${opts.query ? `&query=${encodeURIComponent(opts.query)}` : ""}`, { token, apiUrl });
      if (flags2.json)
        return output(result, flags2);
      if (!result.types.length)
        return deps.log("No schemas found.");
      deps.log(formatTable(["TOKEN", "NAME"], result.types.map((type) => [type.token ?? type.type ?? type.pulumiType ?? "-", type.name ?? "-"])));
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["schema", "list"]);
  addSharedHelp(schemaCmd.command("get").description("Get one resource schema").argument("<token>").option("--detailed", "Return nested Pulumi/provider schema shape when compact output is insufficient").action(async function(tokenArg, opts) {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const query = new URLSearchParams({ type: tokenArg });
      if (opts.detailed)
        query.set("detailed", "true");
      output(await deps.apiRequest(`/schemas/describe?${query.toString()}`, { token, apiUrl }), flags2);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["schema", "get"]);
  return schemaCmd;
}
var schemaCmd = createSchemaCommand();

// src/commands/feedback.ts
function createFeedbackCommand(deps = defaultCliDeps) {
  const feedbackCmd = new Command("feedback").description("Submit feedback to the Opsy team");
  addSharedHelp(feedbackCmd.command("send").description("Send feedback, bug report, or feature request").requiredOption("--message <text>", "Feedback message (max 4000 chars)").option("--error-context <json>", "JSON object with error/debug context").option("--from-llm", "Indicate this feedback is being sent by an LLM").action(async function(opts) {
    const flags2 = getRootFlags(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      let metadata;
      if (opts.errorContext) {
        const parsed = JSON.parse(opts.errorContext);
        metadata = { errorContext: parsed };
      }
      const result = await deps.apiRequest("/feedback", {
        method: "POST",
        body: {
          message: opts.message,
          source: opts.fromLlm ? "cli_llm" : "cli",
          metadata
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(result, flags2);
      deps.log(`Feedback submitted (id: ${result.id}). Thank you!`);
    } catch (error) {
      handleCliError(error, deps);
    }
  }), ["feedback", "send"]);
  return feedbackCmd;
}
var feedbackCmd = createFeedbackCommand();

// src/catalog.ts
init_contracts();

// src/commands/observability.ts
init_client();
init_config();
var defaultDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code)
};
function getRootFlags2(command2) {
  let current = command2;
  while (current.parent)
    current = current.parent;
  return current.opts();
}
function buildQuery2(params) {
  const search = new URLSearchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value)
      search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
function isQueryTimeoutDetails(value) {
  return Boolean(value && typeof value === "object" && "kind" in value && value.kind === "query_timeout");
}
function handleCliError2(error, deps, flags2) {
  if (flags2?.json && error instanceof ApiRequestError) {
    output(error.body, flags2);
    return deps.exit(1);
  }
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ApiRequestError && isQueryTimeoutDetails(error.details)) {
    if (error.details.queryId)
      deps.error(`Query ID: ${error.details.queryId}`);
    if (error.details.status)
      deps.error(`Last status: ${error.details.status}`);
    if (error.details.retryHint)
      deps.error(`Retry hint: ${error.details.retryHint}`);
  }
  return deps.exit(1);
}
function requireProjectValue2(command2, value) {
  const resolved = getProject({ project: value ?? getRootFlags2(command2).project });
  if (!resolved) {
    throw new Error("Missing --project.");
  }
  return resolved;
}
function parseJsonArray(value, flag) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${flag} must be valid JSON.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${flag} must be a JSON array.`);
  }
  return parsed;
}
function applyCatalogHelp(command2, path) {
  const entry = findObserveCommandHelp("aws", path);
  if (!entry)
    return;
  command2.description(entry.purpose);
  const notes = entry.notes?.length ? `
Notes:
${entry.notes.map((note) => `  ${note}`).join(`
`)}` : "";
  const examples = entry.examples.length ? `
Examples:
${entry.examples.map((example) => `  ${example}`).join(`
`)}` : "";
  command2.addHelpText("after", `
${entry.synopsis}${notes}${examples}`);
}
function printLogEvents(deps, events) {
  if (!events.length) {
    deps.log("No log events found.");
    return;
  }
  deps.log(events.map((event) => `[${event.timestamp}] ${event.logStreamName ?? "-"} ${event.message}`).join(`
`));
}
function createObservabilityCommand(deps = defaultDeps) {
  const observabilityCmd = new Command("observability").description("Provider-scoped logs, metrics, and alarms").argument("[provider]").argument("[args...]");
  observabilityCmd.action((provider) => {
    if (!provider) {
      deps.log(getObserveSupportedProvidersMessage());
      deps.log('Use "opsy observability aws --help" for AWS observability commands.');
      return;
    }
    deps.error(`Error: ${getUnsupportedObserveProviderMessage(provider)}`);
    deps.exit(1);
  });
  const awsCmd = new Command("aws").description("Observe AWS CloudWatch logs, metrics, and alarms");
  awsCmd.addHelpText("after", `
${getObserveProviderHelpMessage("aws")}`);
  awsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const logsCmd = new Command("logs").description("CloudWatch Logs commands");
  logsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const groupsCmd = new Command("groups").option("--project <slug>", "Project slug").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--name-prefix <prefix>", "Filter by log group name prefix").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/logs/groups${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        namePrefix: opts.namePrefix,
        limit: opts.limit,
        nextToken: opts.nextToken
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      if (!data.items.length) {
        deps.log("No log groups found.");
        return;
      }
      deps.log(formatTable(["NAME", "RETENTION", "STORED BYTES", "CLASS"], data.items.map((group) => [
        group.name,
        group.retentionInDays == null ? "-" : String(group.retentionInDays),
        group.storedBytes == null ? "-" : String(group.storedBytes),
        group.logGroupClass ?? "-"
      ])));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(groupsCmd, ["logs", "groups"]);
  logsCmd.addCommand(groupsCmd);
  const tailCmd = new Command("tail").option("--project <slug>", "Project slug").requiredOption("--log-group <name>", "Log group name").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--log-stream <name>", "Filter to one log stream").option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum events").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/logs/tail${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        logGroup: opts.logGroup,
        logStream: opts.logStream,
        filterPattern: opts.filterPattern,
        since: opts.since,
        until: opts.until,
        limit: opts.limit
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      printLogEvents(deps, data.events);
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(tailCmd, ["logs", "tail"]);
  logsCmd.addCommand(tailCmd);
  const eventsCmd = new Command("events").option("--project <slug>", "Project slug").requiredOption("--log-group <name>", "Log group name").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--log-stream <name>", "Filter to one log stream").option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum events").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/logs/events${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        logGroup: opts.logGroup,
        logStream: opts.logStream,
        filterPattern: opts.filterPattern,
        since: opts.since,
        until: opts.until,
        limit: opts.limit,
        nextToken: opts.nextToken
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      printLogEvents(deps, data.events);
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(eventsCmd, ["logs", "events"]);
  logsCmd.addCommand(eventsCmd);
  const queryCmd = new Command("query").option("--project <slug>", "Project slug").requiredOption("--log-groups <csv>", "Comma-separated log groups").requiredOption("--query-string <text>", "Logs Insights query").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum rows").option("--timeout-seconds <n>", "Polling timeout").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const data = await deps.apiRequest(`/projects/${project}/observe/aws/logs/query`, {
        method: "POST",
        body: {
          profileId: opts.profile,
          region: opts.region,
          logGroups: String(opts.logGroups).split(",").map((entry) => entry.trim()).filter(Boolean),
          queryString: opts.queryString,
          since: opts.since,
          until: opts.until,
          limit: opts.limit ? Number(opts.limit) : undefined,
          timeoutSeconds: opts.timeoutSeconds ? Number(opts.timeoutSeconds) : undefined
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(data, flags2);
      if (!data.rows.length) {
        deps.log(`Query completed with status ${data.status} and returned no rows.`);
        return;
      }
      const columns = Array.from(new Set(data.rows.flatMap((row) => Object.keys(row))));
      deps.log(formatTable(columns, data.rows.map((row) => columns.map((column) => String(row[column] ?? "")))));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(queryCmd, ["logs", "query"]);
  logsCmd.addCommand(queryCmd);
  awsCmd.addCommand(logsCmd);
  const metricsCmd = new Command("metrics").description("CloudWatch metrics commands");
  metricsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const metricsListCmd = new Command("list").option("--project <slug>", "Project slug").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--namespace <name>", "Metric namespace").option("--metric-name <name>", "Metric name").option("--dimensions <json-array>", "JSON array of AWS dimension filters").option("--recently-active <PT3H>", "Recently active window").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      if (opts.dimensions)
        parseJsonArray(opts.dimensions, "--dimensions");
      const data = await deps.apiRequest(`/projects/${project}/observe/aws/metrics${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        namespace: opts.namespace,
        metricName: opts.metricName,
        dimensions: opts.dimensions,
        recentlyActive: opts.recentlyActive,
        nextToken: opts.nextToken
      })}`, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      if (!data.items.length) {
        deps.log("No metrics found.");
        return;
      }
      deps.log(formatTable(["NAMESPACE", "METRIC", "DIMENSIONS"], data.items.map((metric) => [
        metric.namespace,
        metric.metricName,
        metric.dimensions.map((dimension) => `${dimension.name}=${dimension.value ?? "*"}`).join(", ")
      ])));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(metricsListCmd, ["metrics", "list"]);
  metricsCmd.addCommand(metricsListCmd);
  const metricsQueryCmd = new Command("query").option("--project <slug>", "Project slug").requiredOption("--queries <json-array>", "JSON array of MetricDataQueries").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--scan-by <mode>", "TimestampDescending or TimestampAscending").option("--max-datapoints <n>", "Maximum datapoints").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const queries = parseJsonArray(opts.queries, "--queries");
      const data = await deps.apiRequest(`/projects/${project}/observe/aws/metrics/query`, {
        method: "POST",
        body: {
          profileId: opts.profile,
          region: opts.region,
          queries,
          since: opts.since,
          until: opts.until,
          scanBy: opts.scanBy,
          maxDatapoints: opts.maxDatapoints ? Number(opts.maxDatapoints) : undefined
        },
        token,
        apiUrl
      });
      if (flags2.json)
        return output(data, flags2);
      deps.log(formatTable(["ID", "LABEL", "STATUS", "POINTS"], data.results.map((series) => [
        series.id,
        series.label ?? "-",
        series.statusCode ?? "-",
        String(series.values.length)
      ])));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(metricsQueryCmd, ["metrics", "query"]);
  metricsCmd.addCommand(metricsQueryCmd);
  awsCmd.addCommand(metricsCmd);
  const alarmsCmd = new Command("alarms").description("CloudWatch alarms commands");
  alarmsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const alarmsListCmd = new Command("list").option("--project <slug>", "Project slug").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--state <state>", "OK, ALARM, or INSUFFICIENT_DATA").option("--type <type>", "metric, composite, or all", "all").option("--name-prefix <prefix>", "Alarm name prefix").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/alarms${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        state: opts.state,
        type: opts.type,
        namePrefix: opts.namePrefix,
        limit: opts.limit,
        nextToken: opts.nextToken
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      if (!data.items.length) {
        deps.log("No alarms found.");
        return;
      }
      deps.log(formatTable(["NAME", "TYPE", "STATE", "UPDATED"], data.items.map((alarm) => [
        alarm.name,
        alarm.type,
        alarm.stateValue,
        alarm.stateUpdatedAt ?? "-"
      ])));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(alarmsListCmd, ["alarms", "list"]);
  alarmsCmd.addCommand(alarmsListCmd);
  const alarmsDetailCmd = new Command("detail").option("--project <slug>", "Project slug").requiredOption("--alarm-name <name>", "Alarm name").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/alarms/detail${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        alarmName: opts.alarmName
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      output(data, flags2);
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(alarmsDetailCmd, ["alarms", "detail"]);
  alarmsCmd.addCommand(alarmsDetailCmd);
  const alarmsHistoryCmd = new Command("history").option("--project <slug>", "Project slug").requiredOption("--alarm-name <name>", "Alarm name").option("--profile <profileId>", "Use a specific AWS integration").option("--region <aws-region>", "Override the AWS region").option("--history-item-type <type>", "ConfigurationUpdate, StateUpdate, or Action").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags2 = getRootFlags2(this);
    const token = deps.getToken(flags2);
    const apiUrl = deps.getApiUrl(flags2);
    try {
      const project = requireProjectValue2(this, opts.project);
      const path = `/projects/${project}/observe/aws/alarms/history${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        alarmName: opts.alarmName,
        historyItemType: opts.historyItemType,
        since: opts.since,
        until: opts.until,
        limit: opts.limit,
        nextToken: opts.nextToken
      })}`;
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags2.json)
        return output(data, flags2);
      if (!data.items.length) {
        deps.log("No alarm history found.");
        return;
      }
      deps.log(formatTable(["TIMESTAMP", "TYPE", "SUMMARY"], data.items.map((item) => [
        item.timestamp,
        item.type,
        item.summary ?? "-"
      ])));
    } catch (error) {
      handleCliError2(error, deps, flags2);
    }
  });
  applyCatalogHelp(alarmsHistoryCmd, ["alarms", "history"]);
  alarmsCmd.addCommand(alarmsHistoryCmd);
  awsCmd.addCommand(alarmsCmd);
  observabilityCmd.addCommand(awsCmd);
  return observabilityCmd;
}
var observabilityCmd = createObservabilityCommand();

// src/commands/context.ts
init_config();
function saveContext(project) {
  const config = loadConfig();
  saveConfig({
    ...config,
    project
  });
}
function clearContext() {
  const config = loadConfig();
  saveConfig({
    ...config,
    project: undefined
  });
}
function createContextCommand() {
  const contextCmd = new Command("context").description("Show and manage the default project context");
  contextCmd.command("use").description("Set the default project context").requiredOption("--project <slug>", "Project slug").action((opts) => {
    const project = requireOptionValue(opts.project, "project");
    saveContext(project);
    console.log(`Context set to project=${project}`);
  });
  contextCmd.command("show").description("Show the current project context").action(function() {
    const flags2 = getRootFlags(this);
    const context = {
      project: getProject(flags2) ?? null
    };
    if (flags2.json) {
      output(context, flags2);
      return;
    }
    if (!context.project) {
      console.log("No default context selected.");
      return;
    }
    console.log(`Project: ${context.project}`);
  });
  contextCmd.command("clear").description("Clear the saved project context").action(() => {
    clearContext();
    console.log("Context cleared.");
  });
  return contextCmd;
}
var contextCmd = createContextCommand();

// src/bin.ts
function getCliVersion() {
  try {
    const packageJson = JSON.parse(readFileSync2(new URL("../package.json", import.meta.url), "utf8"));
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
function mapCommanderMessage(message, commandPath) {
  if (message.includes("required option '--project")) {
    return "Missing --project.";
  }
  if (message.includes("missing required argument 'slug'")) {
    if (commandPath[0] === "resource") {
      return "Missing resource slug.";
    }
    if (commandPath[0] === "project") {
      return "Missing project slug.";
    }
  }
  if (message.includes("missing required argument 'shortId'")) {
    return "Missing change shortId.";
  }
  if (message.includes("missing required argument 'executionId'")) {
    return "Missing execution id.";
  }
  return message.replace(/^error:\s*/i, "");
}
var program2 = new Command().name("opsy").description("Opsy CLI — Agent-to-Infrastructure control plane").version(getCliVersion()).option("--token <pat>", "Personal Access Token (env: OPSY_TOKEN)").option("--api-url <url>", "API URL (env: OPSY_API_URL)").option("--json", "Output JSON").option("--quiet", "Minimal output");
program2.addCommand(authCmd);
program2.addCommand(projectCmd);
program2.addCommand(resourceCmd);
program2.addCommand(changeCmd);
program2.addCommand(executionCmd);
program2.addCommand(integrationCmd);
program2.addCommand(schemaCmd);
program2.addCommand(observabilityCmd);
program2.addCommand(feedbackCmd);
program2.addCommand(contextCmd);
program2.configureHelp({
  formatHelp: () => renderCommandHelp([])
});
program2.configureOutput({
  writeErr: () => {},
  outputError: () => {}
});
program2.exitOverride();
async function main() {
  try {
    await program2.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return;
      }
      const parsed = parseCommandString(process.argv.slice(2).join(" "));
      const commandPath = normalizeCommandPath(parsed.positionals);
      const message2 = renderCommandErrorMessage(mapCommanderMessage(error.message, commandPath));
      console.error(`Error: ${message2}`);
      process.exit(error.exitCode ?? 1);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
main();

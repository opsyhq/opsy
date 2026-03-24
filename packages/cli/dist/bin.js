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
  getApiUrl: () => getApiUrl
});
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + `
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
  return flags.apiUrl ?? process.env.OPSY_API_URL ?? loadConfig().apiUrl ?? "http://localhost:4000";
}
var CONFIG_DIR, CONFIG_FILE;
var init_config = __esm(() => {
  CONFIG_DIR = join(homedir(), ".opsy");
  CONFIG_FILE = join(CONFIG_DIR, "config.json");
});

// src/client.ts
var exports_client = {};
__export(exports_client, {
  apiRequest: () => apiRequest,
  ApiRequestError: () => ApiRequestError
});
async function apiRequest(path, opts) {
  const url = `${opts.apiUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${opts.token}`
  };
  let body;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  if (res.status === 204)
    return;
  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, json);
  }
  return json;
}
var ApiRequestError;
var init_client = __esm(() => {
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
  const flags = root.opts();
  const token = getToken2(flags);
  const apiUrl = getApiUrl2(flags);
  try {
    const res = await apiRequest2("/auth/whoami", { token, apiUrl });
    if (flags.json) {
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

// src/commands/project.ts
init_config();
init_client();

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
function output(data, flags) {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (flags.quiet) {
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
var projectCmd = new Command("project").description("Manage workspaces/projects");
projectCmd.command("list").description("List projects").action(async function() {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const projects = await apiRequest("/projects", { token, apiUrl });
    if (flags.json)
      return output(projects, flags);
    if (!projects.length)
      return console.log("No projects found.");
    console.log(formatTable(["SLUG", "NAME", "CREATED"], projects.map((p) => [p.slug, p.name, new Date(p.createdAt).toLocaleDateString()])));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
projectCmd.command("get <slug>").description("Get project details").action(async function(slug) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const project = await apiRequest(`/projects/${slug}`, { token, apiUrl });
    output(project, flags);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
projectCmd.command("create").description("Create a project").requiredOption("--slug <slug>", "Project slug").requiredOption("--name <name>", "Project name").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const project = await apiRequest("/projects", { method: "POST", body: { slug: opts.slug, name: opts.name }, token, apiUrl });
    if (flags.json)
      return output(project, flags);
    console.log(`Project created: ${project.slug}`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/commands/env.ts
init_config();
init_client();
var envCmd = new Command("env").description("Manage environments");
envCmd.command("list").description("List environments").requiredOption("--project <slug>", "Project slug").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const envs = await apiRequest(`/projects/${opts.project}/environments`, { token, apiUrl });
    if (flags.json)
      return output(envs, flags);
    if (!envs.length)
      return console.log("No environments found.");
    console.log(formatTable(["SLUG", "AUTO-APPLY", "CREATED"], envs.map((e) => [e.slug, e.autoApply ? "yes" : "no", new Date(e.createdAt).toLocaleDateString()])));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
envCmd.command("get").description("Get environment details").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const env = await apiRequest(`/projects/${opts.project}/environments/${opts.env}`, { token, apiUrl });
    output(env, flags);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
envCmd.command("create").description("Create an environment").requiredOption("--project <slug>", "Project slug").requiredOption("--slug <slug>", "Environment slug").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const env = await apiRequest(`/projects/${opts.project}/environments`, { method: "POST", body: { slug: opts.slug }, token, apiUrl });
    if (flags.json)
      return output(env, flags);
    console.log(`Environment created: ${env.slug}`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/commands/resource.ts
init_config();
init_client();
var defaultDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code)
};
function getRootFlags(command) {
  let current = command;
  while (current.parent)
    current = current.parent;
  return current.opts();
}
function handleCliError(error, deps) {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}
function createResourceCommand(deps = defaultDeps) {
  const resourceCmd = new Command("resource").description("Manage resources");
  resourceCmd.command("ls").description("List resources").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--parent <slug>", "Parent resource slug").action(async function(opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const qs = opts.parent ? `?parent=${opts.parent}` : "";
    try {
      const resources = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources${qs}`, { token, apiUrl });
      if (flags.json)
        return output(resources, flags);
      if (!resources.length) {
        deps.log("No resources found.");
        return;
      }
      deps.log(formatTable(["SLUG", "TYPE", "STATUS"], resources.map((resource) => [resource.slug, resource.type, resource.status])));
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("get <slug>").description("Get resource details").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--live", "Include live cloud outputs").action(async function(slug, opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const resource = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}`, { token, apiUrl });
      if (!opts.live) {
        output(resource, flags);
        return;
      }
      try {
        const live = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/live`, { token, apiUrl });
        output({ ...resource, live }, flags);
      } catch (error) {
        deps.error(`Warning: failed to read live outputs: ${error instanceof Error ? error.message : String(error)}`);
        output(resource, flags);
      }
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("sync <slug>").description("Re-read a resource from cloud and refresh conflict state").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").action(async function(slug, opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const result = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/sync`, { method: "POST", token, apiUrl });
      output(result, flags);
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("accept-live <slug>").description("Accept the recorded live conflict snapshot into stored inputs").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").action(async function(slug, opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const result = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/accept-live`, { method: "POST", token, apiUrl });
      output(result, flags);
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("promote-current <slug>").description("Create a change to push stored desired inputs back to the cloud").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").action(async function(slug, opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const result = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/promote-current`, { method: "POST", token, apiUrl });
      if (flags.json) {
        output(result, flags);
        return;
      }
      deps.log(`Change ${result.change.shortId} created with ${result.operations.length} operation(s).`);
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("restore <slug>").description("Create a change that restores the resource inputs captured before an operation").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--operation <id>", "Operation ID to restore from").action(async function(slug, opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const result = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/${slug}/restore`, { method: "POST", body: { operationId: opts.operation }, token, apiUrl });
      if (flags.json) {
        output(result, flags);
        return;
      }
      deps.log(`Change ${result.change.shortId} created with ${result.operations.length} operation(s).`);
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  resourceCmd.command("tree").description("Show resource tree").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--depth <n>", "Tree depth", "3").action(async function(opts) {
    const flags = getRootFlags(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      let printNode = function(node, indent) {
        const status = node.status === "live" ? "✓" : node.status === "failed" ? "✗" : "·";
        deps.log(`${indent}${status} ${node.slug} (${node.type}) [${node.status}]`);
        for (const child of node.children ?? [])
          printNode(child, indent + "  ");
      };
      const tree = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/resources/tree?depth=${opts.depth}`, { token, apiUrl });
      if (flags.json)
        return output(tree, flags);
      if (!tree.length) {
        deps.log("No resources found.");
        return;
      }
      for (const node of tree)
        printNode(node, "");
    } catch (error) {
      handleCliError(error, deps);
    }
  });
  return resourceCmd;
}
var resourceCmd = createResourceCommand();

// src/commands/change.ts
init_config();
init_client();
var changeCmd = new Command("change").description("Manage changes");
changeCmd.command("create").description("Create a change").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--mutations <json>", "Mutations JSON array").option("--summary <text>", "Change summary").option("--apply", "Apply immediately after creating the change").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    if (opts.apply && !opts.mutations) {
      throw new Error("--apply requires --mutations");
    }
    let result;
    if (opts.mutations) {
      const body = { mutations: JSON.parse(opts.mutations) };
      if (opts.summary)
        body.summary = opts.summary;
      result = await apiRequest(`/projects/${opts.project}/environments/${opts.env}/changes`, {
        method: "POST",
        body,
        token,
        apiUrl
      });
    } else {
      result = await apiRequest(`/projects/${opts.project}/environments/${opts.env}/changes`, {
        method: "POST",
        body: opts.summary ? { summary: opts.summary } : {},
        token,
        apiUrl
      });
    }
    if (opts.apply && result.change?.shortId) {
      const applied = await apiRequest(`/changes/${result.change.shortId}/apply`, {
        method: "POST",
        token,
        apiUrl
      });
      result = { ...result, apply: applied };
    }
    if (flags.json)
      return output(result, flags);
    const shortId = result.change?.shortId ?? result.shortId;
    const opCount = result.operations?.length;
    if (typeof opCount === "number") {
      console.log(`Change ${shortId} created with ${opCount} operation(s).`);
    } else {
      console.log(`Change ${shortId} created.`);
    }
    if (result.apply?.events) {
      for (const event of result.apply.events) {
        const status = event.data?.status ?? "";
        const slug = event.data?.resourceSlug ?? "";
        console.log(`${event.event}: ${slug} ${status}`);
      }
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("update <shortId>").description("Append mutations to an open change").requiredOption("--mutations <json>", "Mutations JSON array").option("--summary <text>", "Change summary override").option("--apply", "Apply immediately after updating the change").action(async function(shortId, opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const body = {
      mutations: JSON.parse(opts.mutations)
    };
    if (opts.summary)
      body.summary = opts.summary;
    let result = await apiRequest(`/changes/${shortId}/mutations`, {
      method: "POST",
      body,
      token,
      apiUrl
    });
    if (opts.apply) {
      const applied = await apiRequest(`/changes/${shortId}/apply`, {
        method: "POST",
        token,
        apiUrl
      });
      result = { ...result, apply: applied };
    }
    if (flags.json)
      return output(result, flags);
    console.log(`${result.operations.length} operation(s) added to change ${shortId}.`);
    if (result.apply?.events) {
      for (const event of result.apply.events) {
        const status = event.data?.status ?? "";
        const slug = event.data?.resourceSlug ?? "";
        console.log(`${event.event}: ${slug} ${status}`);
      }
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("list").description("List changes").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const changes = await apiRequest(`/projects/${opts.project}/environments/${opts.env}/changes`, { token, apiUrl });
    if (flags.json)
      return output(changes, flags);
    if (!changes.length)
      return console.log("No changes found.");
    console.log(formatTable(["SHORT-ID", "STATUS", "SUMMARY", "CREATED"], changes.map((c) => [c.shortId, c.status, c.summary ?? "-", new Date(c.createdAt).toLocaleDateString()])));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("get <shortId>").description("Get change details").action(async function(shortId) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest(`/changes/${shortId}`, { token, apiUrl });
    if (flags.json)
      return output(result, flags);
    const c = result.change;
    console.log(`Change ${c.shortId} (${c.status})`);
    if (c.summary)
      console.log(`Summary: ${c.summary}`);
    console.log(`
Operations (${result.operations.length}):`);
    for (const op of result.operations) {
      console.log(`  ${op.kind.toUpperCase()} ${op.resourceSlug} (${op.resourceType}) — ${op.status}`);
      if (op.error)
        console.log(`    Error: ${op.error}`);
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("preview <shortId>").description("Preview a change").action(async function(shortId) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest(`/changes/${shortId}/preview`, { method: "POST", token, apiUrl });
    if (flags.json)
      return output(result, flags);
    console.log(`Preview for ${shortId}:`);
    for (const op of result.operations) {
      const prefix = op.kind === "create" ? "+" : op.kind === "delete" ? "-" : "~";
      console.log(`  ${prefix} ${op.resourceSlug} (${op.kind})`);
      if (op.diff)
        console.log(`    ${JSON.stringify(op.diff)}`);
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("apply <shortId>").description("Apply a change").action(async function(shortId) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest(`/changes/${shortId}/apply`, { method: "POST", token, apiUrl });
    if (flags.json)
      return output(result, flags);
    if (result.events) {
      for (const event of result.events) {
        const status = event.data?.status ?? "";
        const slug = event.data?.resourceSlug ?? "";
        console.log(`${event.event}: ${slug} ${status}`);
      }
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("dismiss <shortId>").description("Dismiss a change").action(async function(shortId) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest(`/changes/${shortId}/dismiss`, { method: "POST", token, apiUrl });
    if (flags.json)
      return output(result, flags);
    console.log(`Change ${result.shortId} dismissed.`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
changeCmd.command("retry <shortId>").description("Retry a failed change").action(async function(shortId) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest(`/changes/${shortId}/retry`, { method: "POST", token, apiUrl });
    if (flags.json)
      return output(result, flags);
    console.log(`Change ${result.shortId} retried — now ${result.status}.`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/commands/schema.ts
init_config();
init_client();
var schemaCmd = new Command("schema").description("Browse resource schemas");
schemaCmd.command("providers").description("List available providers").action(async function() {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const providers = await apiRequest("/schemas/providers", { token, apiUrl });
    if (flags.json)
      return output(providers, flags);
    for (const p of providers)
      console.log(`  ${p.name ?? p.pkg ?? p}`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
schemaCmd.command("types").description("List resource types").requiredOption("--provider <pkg>", "Provider package").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const types = await apiRequest(`/schemas/types?provider=${opts.provider}`, { token, apiUrl });
    if (flags.json)
      return output(types, flags);
    for (const t of types)
      console.log(`  ${t.token ?? t}`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
schemaCmd.command("describe").description("Describe a resource type").requiredOption("--type <token>", "Resource type token").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const desc = await apiRequest(`/schemas/describe?type=${opts.type}`, { token, apiUrl });
    output(desc, flags);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/commands/provider.ts
init_config();
init_client();
var providerCmd = new Command("provider").description("Manage provider profiles");
providerCmd.command("list").description("List provider profiles").action(async function() {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const profiles = await apiRequest("/providers", { token, apiUrl });
    if (flags.json)
      return output(profiles, flags);
    if (!profiles.length)
      return console.log("No provider profiles.");
    console.log(formatTable(["ID", "PROVIDER", "PROFILE"], profiles.map((p) => [p.id.slice(0, 8), p.providerPkg, p.profileName])));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
providerCmd.command("get <id>").description("Get provider profile").action(async function(id) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const profile = await apiRequest(`/providers/${id}`, { token, apiUrl });
    output(profile, flags);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});
providerCmd.command("create").description("Create provider profile").requiredOption("--provider <pkg>", "Provider package (aws, gcp, cloudflare)").requiredOption("--name <name>", "Profile name").requiredOption("--config <json>", "Config JSON").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const config = JSON.parse(opts.config);
    const profile = await apiRequest("/providers", {
      method: "POST",
      body: { providerPkg: opts.provider, profileName: opts.name, config },
      token,
      apiUrl
    });
    if (flags.json)
      return output(profile, flags);
    console.log(`Provider profile created: ${profile.id}`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/commands/feedback.ts
init_config();
init_client();
var feedbackCmd = new Command("feedback").description("Submit feedback to the Opsy team");
feedbackCmd.command("send").description("Send feedback, bug report, or feature request").requiredOption("--message <text>", "Feedback message (max 4000 chars)").option("--from-llm", "Indicate this feedback is being sent by an LLM").action(async function(opts) {
  const flags = this.parent.parent.opts();
  const token = getToken(flags);
  const apiUrl = getApiUrl(flags);
  try {
    const result = await apiRequest("/feedback", {
      method: "POST",
      body: {
        message: opts.message,
        source: opts.fromLlm ? "cli_llm" : "cli"
      },
      token,
      apiUrl
    });
    if (flags.json)
      return output(result, flags);
    console.log(`Feedback submitted (id: ${result.id}). Thank you!`);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
});

// src/catalog.ts
var DISCOVERY_PROVIDERS = [
  { id: "aws", label: "AWS" }
];
function getUnsupportedDiscoveryProviderMessage(provider) {
  return `Discovery is not implemented for "${provider}". Use manual import.`;
}
var OBSERVE_TIME_NOTES = [
  "Time values accept ISO timestamps or relative durations like 30s, 15m, 1h, or 7d.",
  "JSON-typed options use raw AWS-like JSON arrays for --dimensions and --queries."
];
var OBSERVE_AWS_HELP_CATALOG = {
  provider: "aws",
  title: "AWS CloudWatch observe commands",
  intro: "Read-only CloudWatch logs, metrics, and alarms for an environment or explicit AWS profile.",
  notes: OBSERVE_TIME_NOTES,
  commands: [
    {
      path: ["logs", "groups"],
      synopsis: "observe aws logs groups --project <project> --env <env> [--profile <profileId>] [--region <aws-region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch log groups.",
      examples: [
        "observe aws logs groups --project acme --env prod",
        "observe aws logs groups --project acme --env prod --name-prefix /aws/lambda/"
      ]
    },
    {
      path: ["logs", "tail"],
      synopsis: "observe aws logs tail --project <project> --env <env> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]",
      purpose: "Fetch a bounded one-shot view of recent log events, newest first.",
      examples: [
        "observe aws logs tail --project acme --env prod --log-group /aws/lambda/payments",
        "observe aws logs tail --project acme --env prod --log-group /aws/ecs/app --since 1h --filter-pattern ERROR"
      ],
      notes: ["Default --since is 15m."]
    },
    {
      path: ["logs", "events"],
      synopsis: "observe aws logs events --project <project> --env <env> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
      purpose: "Retrieve filtered log events in chronological order.",
      examples: [
        "observe aws logs events --project acme --env prod --log-group /aws/lambda/payments --since 30m",
        "observe aws logs events --project acme --env prod --log-group /aws/ecs/app --log-stream ecs/app/123"
      ]
    },
    {
      path: ["logs", "query"],
      synopsis: "observe aws logs query --project <project> --env <env> --log-groups <csv> --query-string <text> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]",
      purpose: "Run a CloudWatch Logs Insights query and poll until completion.",
      examples: [
        "observe aws logs query --project acme --env prod --log-groups /aws/lambda/payments --query-string 'fields @timestamp, @message | sort @timestamp desc | limit 20'",
        "observe aws logs query --project acme --env prod --log-groups /aws/lambda/a,/aws/lambda/b --since 2h --query-string 'stats count() by bin(5m)'"
      ],
      notes: ["Default --since is 1h. Default --timeout-seconds is 15."]
    },
    {
      path: ["metrics", "list"],
      synopsis: "observe aws metrics list --project <project> --env <env> [--profile <profileId>] [--region <aws-region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]",
      purpose: "List CloudWatch metric descriptors and dimension sets.",
      examples: [
        "observe aws metrics list --project acme --env prod --namespace AWS/Lambda",
        "observe aws metrics list --project acme --env prod --namespace AWS/EC2 --metric-name CPUUtilization"
      ]
    },
    {
      path: ["metrics", "query"],
      synopsis: "observe aws metrics query --project <project> --env <env> --queries <json-array> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]",
      purpose: "Run CloudWatch GetMetricData queries and return raw datapoints.",
      examples: [
        `observe aws metrics query --project acme --env prod --queries '[{"Id":"cpu","MetricStat":{"Metric":{"Namespace":"AWS/EC2","MetricName":"CPUUtilization","Dimensions":[{"Name":"InstanceId","Value":"i-123"}]},"Period":300,"Stat":"Average"}}]'`,
        `observe aws metrics query --project acme --env prod --queries '[{"Id":"errors","Expression":"SUM(METRICS())"}]' --since 6h`
      ],
      notes: ["Default --since is 1h. Default --until is now."]
    },
    {
      path: ["alarms", "list"],
      synopsis: "observe aws alarms list --project <project> --env <env> [--profile <profileId>] [--region <aws-region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch metric and composite alarms.",
      examples: [
        "observe aws alarms list --project acme --env prod",
        "observe aws alarms list --project acme --env prod --state ALARM --type metric"
      ],
      notes: ["Default --type is all."]
    },
    {
      path: ["alarms", "detail"],
      synopsis: "observe aws alarms detail --project <project> --env <env> --alarm-name <name> [--profile <profileId>] [--region <aws-region>]",
      purpose: "Fetch the full current config and state for one alarm.",
      examples: [
        "observe aws alarms detail --project acme --env prod --alarm-name HighCPU",
        "observe aws alarms detail --project acme --env prod --alarm-name CompositeLatencyAlarm"
      ]
    },
    {
      path: ["alarms", "history"],
      synopsis: "observe aws alarms history --project <project> --env <env> --alarm-name <name> [--profile <profileId>] [--region <aws-region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch alarm history entries.",
      examples: [
        "observe aws alarms history --project acme --env prod --alarm-name HighCPU",
        "observe aws alarms history --project acme --env prod --alarm-name HighCPU --history-item-type StateUpdate --since 7d"
      ],
      notes: ["Default --since is 24h."]
    }
  ]
};
function getObserveProviderHelpCatalog(provider) {
  if (provider === "aws")
    return OBSERVE_AWS_HELP_CATALOG;
  return null;
}
function getUnsupportedObserveProviderMessage(provider) {
  return `Observe is not implemented for "${provider}". Use "observe" to list supported providers.`;
}
function findObserveCommandHelp(provider, path) {
  const catalog = getObserveProviderHelpCatalog(provider);
  return catalog?.commands.find((entry) => entry.path.join(" ") === path.join(" "));
}
function renderObserveSupportedProviders() {
  return `Supported observe providers:
  aws`;
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

// src/commands/discover.ts
init_config();
init_client();
var defaultDeps2 = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code)
};
function formatSupportedDiscoveryProviders() {
  return `Supported discovery providers:
${DISCOVERY_PROVIDERS.map((provider) => `  ${provider.id}`).join(`
`)}`;
}
function getRootFlags2(command) {
  let current = command;
  while (current.parent)
    current = current.parent;
  return current.opts();
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
function handleCliError2(error, deps) {
  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  return deps.exit(1);
}
function createDiscoverCommand(deps = defaultDeps2) {
  const discoverCmd = new Command("discover").description("Provider-scoped resource discovery").argument("[provider]").argument("[args...]");
  discoverCmd.action((provider) => {
    if (!provider) {
      deps.log(formatSupportedDiscoveryProviders());
      deps.log('Use "opsy discover aws --help" for AWS discovery commands.');
      return;
    }
    deps.error(`Error: ${getUnsupportedDiscoveryProviderMessage(provider)}`);
    deps.exit(1);
  });
  const awsCmd = new Command("aws").description("Discover existing AWS resources");
  awsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  awsCmd.command("types").description("List AWS resource types that support discovery").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--query <text>", "Filter by resource type").action(async function(opts) {
    const flags = getRootFlags2(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/discover/aws/types${buildQuery({ query: opts.query })}`;
    try {
      const types = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(types, flags);
      if (!types.length) {
        deps.log("No AWS discovery types found.");
        return;
      }
      deps.log(formatTable(["AWS TYPE", "PULUMI TYPE"], types.map((type) => [type.reType, type.pulumiType])));
    } catch (error) {
      handleCliError2(error, deps);
    }
  });
  awsCmd.command("list").description("List existing AWS resources").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--type <reType>", "Filter by AWS Resource Explorer type").option("--region <region>", "Filter by AWS region").option("--profile <profileId>", "Use a specific AWS provider profile").action(async function(opts) {
    const flags = getRootFlags2(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/discover/aws${buildQuery({
      type: opts.type,
      region: opts.region,
      profileId: opts.profile
    })}`;
    try {
      const resources = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(resources, flags);
      if (!resources.length) {
        deps.log("No AWS resources found.");
        return;
      }
      deps.log(formatTable(["NAME", "CLOUD ID", "TYPE", "REGION", "SERVICE"], resources.map((resource) => [resource.name, resource.cloudId, resource.reType, resource.region, resource.service])));
    } catch (error) {
      handleCliError2(error, deps);
    }
  });
  awsCmd.command("inspect").description("Inspect a single AWS resource").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--cloud-id <id>", "AWS cloud ID").requiredOption("--type <type>", "Pulumi token or AWS Resource Explorer type").option("--profile <profileId>", "Use a specific AWS provider profile").action(async function(opts) {
    const flags = getRootFlags2(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/discover/aws/inspect${buildQuery({
      cloudId: opts.cloudId,
      type: opts.type,
      profileId: opts.profile
    })}`;
    try {
      const detail = await deps.apiRequest(path, { token, apiUrl });
      output(detail, flags);
    } catch (error) {
      handleCliError2(error, deps);
    }
  });
  awsCmd.command("import").description("Import discovered AWS resources").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--items <json>", "JSON array of {cloudId, type, slug}").action(async function(opts) {
    const flags = getRootFlags2(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const items = JSON.parse(opts.items);
      const result = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/discover/aws/import`, { method: "POST", body: { items }, token, apiUrl });
      if (flags.json)
        return output(result, flags);
      deps.log(`Change ${result.change.shortId} created with ${result.operations.length} AWS import operation(s).`);
    } catch (error) {
      handleCliError2(error, deps);
    }
  });
  discoverCmd.addCommand(awsCmd);
  return discoverCmd;
}
var discoverCmd = createDiscoverCommand();

// src/commands/observe.ts
init_client();
init_config();
var defaultDeps3 = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  exit: (code) => process.exit(code)
};
function getRootFlags3(command) {
  let current = command;
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
function handleCliError3(error, deps, flags) {
  if (flags?.json && error instanceof ApiRequestError) {
    output(error.body, flags);
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
function applyCatalogHelp(command, path) {
  const entry = findObserveCommandHelp("aws", path);
  if (!entry)
    return;
  command.description(entry.purpose);
  const notes = entry.notes?.length ? `
Notes:
${entry.notes.map((note) => `  ${note}`).join(`
`)}` : "";
  const examples = entry.examples.length ? `
Examples:
${entry.examples.map((example) => `  ${example}`).join(`
`)}` : "";
  command.addHelpText("after", `
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
function createObserveCommand(deps = defaultDeps3) {
  const observeCmd = new Command("observe").description("Provider-scoped logs, metrics, and alarms").argument("[provider]").argument("[args...]");
  observeCmd.action((provider) => {
    if (!provider) {
      deps.log(renderObserveSupportedProviders());
      deps.log('Use "opsy observe aws --help" for AWS observe commands.');
      return;
    }
    deps.error(`Error: ${getUnsupportedObserveProviderMessage(provider)}`);
    deps.exit(1);
  });
  const awsCmd = new Command("aws").description("Observe AWS CloudWatch logs, metrics, and alarms");
  awsCmd.addHelpText("after", `
${renderObserveProviderHelp("aws")}`);
  awsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const logsCmd = new Command("logs").description("CloudWatch Logs commands");
  logsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const groupsCmd = new Command("groups").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--name-prefix <prefix>", "Filter by log group name prefix").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/groups${buildQuery2({
      profileId: opts.profile,
      region: opts.region,
      namePrefix: opts.namePrefix,
      limit: opts.limit,
      nextToken: opts.nextToken
    })}`;
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
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
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(groupsCmd, ["logs", "groups"]);
  logsCmd.addCommand(groupsCmd);
  const tailCmd = new Command("tail").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--log-group <name>", "Log group name").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--log-stream <name>", "Filter to one log stream").option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum events").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/tail${buildQuery2({
      profileId: opts.profile,
      region: opts.region,
      logGroup: opts.logGroup,
      logStream: opts.logStream,
      filterPattern: opts.filterPattern,
      since: opts.since,
      until: opts.until,
      limit: opts.limit
    })}`;
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
      printLogEvents(deps, data.events);
    } catch (error) {
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(tailCmd, ["logs", "tail"]);
  logsCmd.addCommand(tailCmd);
  const eventsCmd = new Command("events").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--log-group <name>", "Log group name").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--log-stream <name>", "Filter to one log stream").option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum events").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/events${buildQuery2({
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
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
      printLogEvents(deps, data.events);
    } catch (error) {
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(eventsCmd, ["logs", "events"]);
  logsCmd.addCommand(eventsCmd);
  const queryCmd = new Command("query").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--log-groups <csv>", "Comma-separated log groups").requiredOption("--query-string <text>", "Logs Insights query").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Maximum rows").option("--timeout-seconds <n>", "Polling timeout").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const data = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/query`, {
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
      if (flags.json)
        return output(data, flags);
      if (!data.rows.length) {
        deps.log(`Query completed with status ${data.status} and returned no rows.`);
        return;
      }
      const columns = Array.from(new Set(data.rows.flatMap((row) => Object.keys(row))));
      deps.log(formatTable(columns, data.rows.map((row) => columns.map((column) => String(row[column] ?? "")))));
    } catch (error) {
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(queryCmd, ["logs", "query"]);
  logsCmd.addCommand(queryCmd);
  awsCmd.addCommand(logsCmd);
  const metricsCmd = new Command("metrics").description("CloudWatch metrics commands");
  metricsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const metricsListCmd = new Command("list").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--namespace <name>", "Metric namespace").option("--metric-name <name>", "Metric name").option("--dimensions <json-array>", "JSON array of AWS dimension filters").option("--recently-active <PT3H>", "Recently active window").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      if (opts.dimensions)
        parseJsonArray(opts.dimensions, "--dimensions");
      const data = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/observe/aws/metrics${buildQuery2({
        profileId: opts.profile,
        region: opts.region,
        namespace: opts.namespace,
        metricName: opts.metricName,
        dimensions: opts.dimensions,
        recentlyActive: opts.recentlyActive,
        nextToken: opts.nextToken
      })}`, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
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
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(metricsListCmd, ["metrics", "list"]);
  metricsCmd.addCommand(metricsListCmd);
  const metricsQueryCmd = new Command("query").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--queries <json-array>", "JSON array of MetricDataQueries").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--scan-by <mode>", "TimestampDescending or TimestampAscending").option("--max-datapoints <n>", "Maximum datapoints").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    try {
      const queries = parseJsonArray(opts.queries, "--queries");
      const data = await deps.apiRequest(`/projects/${opts.project}/environments/${opts.env}/observe/aws/metrics/query`, {
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
      if (flags.json)
        return output(data, flags);
      deps.log(formatTable(["ID", "LABEL", "STATUS", "POINTS"], data.results.map((series) => [
        series.id,
        series.label ?? "-",
        series.statusCode ?? "-",
        String(series.values.length)
      ])));
    } catch (error) {
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(metricsQueryCmd, ["metrics", "query"]);
  metricsCmd.addCommand(metricsQueryCmd);
  awsCmd.addCommand(metricsCmd);
  const alarmsCmd = new Command("alarms").description("CloudWatch alarms commands");
  alarmsCmd.action(function() {
    deps.log(this.helpInformation());
  });
  const alarmsListCmd = new Command("list").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--state <state>", "OK, ALARM, or INSUFFICIENT_DATA").option("--type <type>", "metric, composite, or all", "all").option("--name-prefix <prefix>", "Alarm name prefix").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms${buildQuery2({
      profileId: opts.profile,
      region: opts.region,
      state: opts.state,
      type: opts.type,
      namePrefix: opts.namePrefix,
      limit: opts.limit,
      nextToken: opts.nextToken
    })}`;
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
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
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(alarmsListCmd, ["alarms", "list"]);
  alarmsCmd.addCommand(alarmsListCmd);
  const alarmsDetailCmd = new Command("detail").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--alarm-name <name>", "Alarm name").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms/detail${buildQuery2({
      profileId: opts.profile,
      region: opts.region,
      alarmName: opts.alarmName
    })}`;
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      output(data, flags);
    } catch (error) {
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(alarmsDetailCmd, ["alarms", "detail"]);
  alarmsCmd.addCommand(alarmsDetailCmd);
  const alarmsHistoryCmd = new Command("history").requiredOption("--project <slug>", "Project slug").requiredOption("--env <slug>", "Environment slug").requiredOption("--alarm-name <name>", "Alarm name").option("--profile <profileId>", "Use a specific AWS provider profile").option("--region <aws-region>", "Override the AWS region").option("--history-item-type <type>", "ConfigurationUpdate, StateUpdate, or Action").option("--since <duration-or-iso>", "Range start").option("--until <duration-or-iso>", "Range end").option("--limit <n>", "Page size").option("--next-token <token>", "Pagination token").action(async function(opts) {
    const flags = getRootFlags3(this);
    const token = deps.getToken(flags);
    const apiUrl = deps.getApiUrl(flags);
    const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms/history${buildQuery2({
      profileId: opts.profile,
      region: opts.region,
      alarmName: opts.alarmName,
      historyItemType: opts.historyItemType,
      since: opts.since,
      until: opts.until,
      limit: opts.limit,
      nextToken: opts.nextToken
    })}`;
    try {
      const data = await deps.apiRequest(path, { token, apiUrl });
      if (flags.json)
        return output(data, flags);
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
      handleCliError3(error, deps, flags);
    }
  });
  applyCatalogHelp(alarmsHistoryCmd, ["alarms", "history"]);
  alarmsCmd.addCommand(alarmsHistoryCmd);
  awsCmd.addCommand(alarmsCmd);
  observeCmd.addCommand(awsCmd);
  return observeCmd;
}
var observeCmd = createObserveCommand();

// src/bin.ts
function getCliVersion() {
  try {
    const packageJson = JSON.parse(readFileSync2(new URL("../package.json", import.meta.url), "utf8"));
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
var program2 = new Command().name("opsy").description("Opsy CLI — Agent-to-Infrastructure control plane").version(getCliVersion()).option("--token <pat>", "Personal Access Token (env: OPSY_TOKEN)").option("--api-url <url>", "API URL (env: OPSY_API_URL)").option("--json", "Output JSON").option("--quiet", "Minimal output");
program2.addCommand(authCmd);
program2.addCommand(projectCmd);
program2.addCommand(envCmd);
program2.addCommand(resourceCmd);
program2.addCommand(changeCmd);
program2.addCommand(schemaCmd);
program2.addCommand(discoverCmd);
program2.addCommand(observeCmd);
program2.addCommand(providerCmd);
program2.addCommand(feedbackCmd);
program2.parse();

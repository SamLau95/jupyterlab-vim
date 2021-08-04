import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { ICodeMirror, CodeMirrorEditor } from '@jupyterlab/codemirror';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ReadonlyPartialJSONObject } from '@lumino/coreutils';

import { ElementExt } from '@lumino/domutils';

/**
 * A boolean indicating whether the platform is Mac.
 */
const IS_MAC = !!navigator.platform.match(/Mac/i);
const PLUGIN_NAME = '@axlair/jupyterlab_vim';
let enabled = false;

/**
 * Initialization data for the jupyterlab_vim extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_NAME,
  autoStart: true,
  activate: activateCellVim,
  requires: [INotebookTracker, ICodeMirror, ISettingRegistry]
};

class VimCell {
  constructor(
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    cm: CodeMirrorEditor
  ) {
    this._tracker = tracker;
    this._app = app;
    this._cm = cm;
    this._onActiveCellChanged();
    this._tracker.activeCellChanged.connect(this._onActiveCellChanged, this);
  }

  private _onActiveCellChanged(): void {
    const activeCell = this._tracker.activeCell;
    if (activeCell !== null) {
      if (!enabled) {
        return;
      }
      const { commands } = this._app;
      const editor = activeCell.editor as CodeMirrorEditor;
      editor.setOption('keyMap', 'vim');

      const extraKeys = editor.getOption('extraKeys') || {};

      if (!IS_MAC) {
        extraKeys['Ctrl-C'] = false;
      }

      (this._cm as any).prototype.save = (): void => {
        commands.execute('docmanager:save');
      };

      editor.setOption('extraKeys', extraKeys);
    }
  }

  private _tracker: INotebookTracker;
  private _app: JupyterFrontEnd;
  private _cm: CodeMirrorEditor;
}

async function setupPlugin(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  jlabCodeMirror: ICodeMirror
): Promise<void> {
  await app.restored;
  const { commands, shell } = app;
  await jlabCodeMirror.ensureVimKeymap();

  //////////////////////////////////////////////////////////////////////////////
  // sam's custom vim keybindings
  //////////////////////////////////////////////////////////////////////////////
  const CodeMirror = (jlabCodeMirror.CodeMirror as unknown) as CodeMirrorEditor;
  (CodeMirror as any).Vim.map('jk', '<Esc>', 'insert');

  function getCurrent(args: ReadonlyPartialJSONObject): NotebookPanel | null {
    const widget = tracker.currentWidget;
    const activate = args['activate'] !== false;

    if (activate && widget) {
      shell.activateById(widget.id);
    }

    return widget;
  }
  function isEnabled(): boolean {
    return (
      enabled &&
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget
    );
  }

  commands.addCommand('select-first-cell', {
    label: 'Select First Cell',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { content } = current;
        content.activeCellIndex = 0;
        content.deselectAll();
        if (content.activeCell !== null) {
          ElementExt.scrollIntoViewIfNeeded(
            content.node,
            content.activeCell.node
          );
        }
      }
    },
    isEnabled
  });
  commands.addCommand('select-last-cell', {
    label: 'Select Last Cell',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { content } = current;
        content.activeCellIndex = current.content.widgets.length - 1;
        content.deselectAll();
        if (content.activeCell !== null) {
          ElementExt.scrollIntoViewIfNeeded(
            content.node,
            content.activeCell.node
          );
        }
      }
    },
    isEnabled
  });
  commands.addCommand('center-cell', {
    label: 'Center Cell',
    execute: args => {
      const current = getCurrent(args);

      if (current && current.content.activeCell !== null) {
        const er = current.content.activeCell.inputArea.node.getBoundingClientRect();
        current.content.scrollToPosition(er.bottom, 0);
      }
    },
    isEnabled
  });

  // tslint:disable:no-unused-expression
  new VimCell(app, tracker, CodeMirror);
}

function activateCellVim(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  jlabCodeMirror: ICodeMirror,
  settingRegistry: ISettingRegistry
): Promise<void> {
  let hasEverBeenEnabled = false;

  function updateSettings(settings: ISettingRegistry.ISettings): void {
    // TODO: This does not reset any cells that have been used with VIM
    enabled = settings.get('enabled').composite === true;
    if (enabled && !hasEverBeenEnabled) {
      hasEverBeenEnabled = true;
      setupPlugin(app, tracker, jlabCodeMirror);
    }
  }

  settingRegistry.load(`${PLUGIN_NAME}:plugin`).then(
    (settings: ISettingRegistry.ISettings) => {
      updateSettings(settings);
      settings.changed.connect(updateSettings);
    },
    (err: Error) => {
      console.error(
        `Could not load settings, so did not active ${PLUGIN_NAME}: ${err}`
      );
    }
  );
  return Promise.resolve();
}

export default extension;

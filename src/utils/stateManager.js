/**
 * @fileoverview 状态持久化管理工具 - 使用Tauri Settings API进行状态的保存和恢复
 * 提供应用状态的持久化存储，包括展开状态、当前文件、树形数据等
 * @author hhyufan
 * @version 1.2.0
 */

import tauriApi from './tauriApi';

const { settings: settingsApi } = tauriApi;

/**
 * 状态管理器类 - 负责应用状态的持久化存储
 */
class StateManager {
  constructor() {
    this.isTauri = window.__TAURI__ !== undefined;
  }

  /**
   * 保存状态到Tauri settings
   * @param {string} key - 状态键名
   * @param {*} value - 要保存的值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveState(key, value) {
    if (!this.isTauri || !settingsApi) {
      console.warn('Not in Tauri environment, state will not be persisted');
      return false;
    }

    try {
      await settingsApi.set(key, value);
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  }

  async loadState(key, defaultValue = null) {
    if (!this.isTauri || !settingsApi) {
      console.warn('Not in Tauri environment, returning default value');
      return defaultValue;
    }

    try {
      const value = await settingsApi.get(key, defaultValue);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error('Failed to load state:', error);
      return defaultValue;
    }
  }

  async deleteState(key) {
    if (!this.isTauri || !settingsApi) {
      console.warn('Not in Tauri environment');
      return false;
    }

    try {
      await settingsApi.remove(key);
      return true;
    } catch (error) {
      console.error('Failed to delete state:', error);
      return false;
    }
  }

  async clearAllStates() {
    if (!this.isTauri || !settingsApi) {
      console.warn('Not in Tauri environment');
      return false;
    }

    try {
      const keysToDelete = [
        'expandedSections',
        'currentFile',
        'treeData',
        'selectedKeys',
        'editorSettings',
        'themeSettings'
      ];

      for (const key of keysToDelete) {
        try {
          await settingsApi.remove(key);
        } catch (error) {
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to clear all states:', error);
      return false;
    }
  }

  async saveExpandedSections(expandedSections) {

    return await this.saveState('expandedSections', expandedSections);
  }

  async loadExpandedSections() {

    const result = await this.loadState('expandedSections', []);

    return result;
  }

  async saveCurrentFile(currentFile) {

    return await this.saveState('currentFile', currentFile);
  }

  async loadCurrentFile() {

    const result = await this.loadState('currentFile', null);

    return result;
  }

  async saveTreeData(treeData) {

    return await this.saveState('treeData', treeData);
  }

  async loadTreeData() {

    const result = await this.loadState('treeData', []);

    return result;
  }

  async saveSelectedKeys(selectedKeys) {

    return await this.saveState('selectedKeys', selectedKeys);
  }

  async loadSelectedKeys() {

    const result = await this.loadState('selectedKeys', []);

    return result;
  }
}

const stateManager = new StateManager();

export default stateManager;

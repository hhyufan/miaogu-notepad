// 状态持久化管理工具
// 使用Tauri Settings API进行状态的保存和恢复

import tauriApi from './tauriApi';
const { settings: settingsApi } = tauriApi;

class StateManager {
  constructor() {
    this.isTauri = window.__TAURI__ !== undefined;
    console.log('StateManager初始化:', {
      hasTauriApi: !!window.__TAURI__,
      hasSettingsApi: !!settingsApi,
      isTauri: this.isTauri
    });
  }

  // 保存状态到Tauri settings
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

  // 从Tauri settings恢复状态
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

  // 删除指定状态
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

  // 清空所有状态
  async clearAllStates() {
    if (!this.isTauri || !settingsApi) {
      console.warn('Not in Tauri environment');
      return false;
    }

    try {
      // Tauri settings API 没有直接的清空所有方法
      // 这里可以根据需要删除特定的键
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
          // 忽略单个键删除失败的错误
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to clear all states:', error);
      return false;
    }
  }

  // 保存展开状态
  async saveExpandedSections(expandedSections) {
    console.log('保存展开状态:', expandedSections, 'isTauri:', this.isTauri);
    return await this.saveState('expandedSections', expandedSections);
  }

  // 恢复展开状态
  async loadExpandedSections() {
    console.log('加载展开状态, isTauri:', this.isTauri);
    const result = await this.loadState('expandedSections', []);
    console.log('加载到的展开状态:', result);
    return result;
  }

  // 保存当前文件
  async saveCurrentFile(currentFile) {
    console.log('保存当前文件:', currentFile, 'isTauri:', this.isTauri);
    return await this.saveState('currentFile', currentFile);
  }

  // 恢复当前文件
  async loadCurrentFile() {
    console.log('加载当前文件, isTauri:', this.isTauri);
    const result = await this.loadState('currentFile', null);
    console.log('加载到的当前文件:', result);
    return result;
  }

  // 保存树形数据
  async saveTreeData(treeData) {
    console.log('保存树形数据:', treeData, 'isTauri:', this.isTauri);
    return await this.saveState('treeData', treeData);
  }

  // 恢复树形数据
  async loadTreeData() {
    console.log('加载树形数据, isTauri:', this.isTauri);
    const result = await this.loadState('treeData', []);
    console.log('加载到的树形数据:', result);
    return result;
  }

  // 保存选中的键
  async saveSelectedKeys(selectedKeys) {
    console.log('保存选中键:', selectedKeys, 'isTauri:', this.isTauri);
    return await this.saveState('selectedKeys', selectedKeys);
  }

  // 恢复选中的键
  async loadSelectedKeys() {
    console.log('加载选中键, isTauri:', this.isTauri);
    const result = await this.loadState('selectedKeys', []);
    console.log('加载到的选中键:', result);
    return result;
  }
}

// 创建单例实例
const stateManager = new StateManager();

export default stateManager;
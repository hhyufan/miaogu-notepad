#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本号更新工具
用于更新 miaogu-notepad 项目中的版本号
"""

import json
import re
import os
import sys
from pathlib import Path

class VersionUpdater:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.package_json_path = self.project_root / "package.json"
        self.tauri_conf_path = self.project_root / "src-tauri" / "tauri.conf.json"
        self.cargo_toml_path = self.project_root / "src-tauri" / "Cargo.toml"

    def get_current_versions(self):
        """获取当前版本号"""
        versions = {}

        # 读取 package.json
        if self.package_json_path.exists():
            with open(self.package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
                versions['package.json'] = package_data.get('version', 'unknown')

        # 读取 tauri.conf.json
        if self.tauri_conf_path.exists():
            with open(self.tauri_conf_path, 'r', encoding='utf-8') as f:
                tauri_data = json.load(f)
                versions['tauri.conf.json'] = tauri_data.get('version', 'unknown')

        # 读取 Cargo.toml
        if self.cargo_toml_path.exists():
            with open(self.cargo_toml_path, 'r', encoding='utf-8') as f:
                cargo_content = f.read()
                version_match = re.search(r'version\s*=\s*"([^"]+)"', cargo_content)
                if version_match:
                    versions['Cargo.toml'] = version_match.group(1)
                else:
                    versions['Cargo.toml'] = 'unknown'

        return versions

    def validate_version(self, version):
        """验证版本号格式 (语义化版本)"""
        pattern = r'^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$'
        return re.match(pattern, version) is not None

    def update_package_json(self, new_version):
        """更新 package.json 中的版本号"""
        with open(self.package_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        data['version'] = new_version

        with open(self.package_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ 已更新 package.json: {new_version}")

    def update_tauri_conf(self, new_version):
        """更新 tauri.conf.json 中的版本号"""
        with open(self.tauri_conf_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        data['version'] = new_version

        with open(self.tauri_conf_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ 已更新 tauri.conf.json: {new_version}")

    def update_cargo_toml(self, new_version):
        """更新 Cargo.toml 中的版本号"""
        with open(self.cargo_toml_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 只替换 [package] 部分的版本号，避免影响依赖项版本
        new_content = re.sub(
            r'(\[package\][^\[]*?version\s*=\s*")([^"]+)(")',
            f'\\g<1>{new_version}\\g<3>',
            content,
            flags=re.DOTALL
        )

        with open(self.cargo_toml_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"✅ 已更新 Cargo.toml: {new_version}")

    def increment_version(self, version, increment_type):
        """自动递增版本号"""
        parts = version.split('.')
        if len(parts) != 3:
            return None

        major, minor, patch = map(int, parts)

        if increment_type == 'major':
            major += 1
            minor = 0
            patch = 0
        elif increment_type == 'minor':
            minor += 1
            patch = 0
        elif increment_type == 'patch':
            patch += 1

        return f"{major}.{minor}.{patch}"

    def run(self):
        """运行版本更新工具"""
        print("🚀 喵咕记事本版本号更新工具")
        print("=" * 40)

        # 显示当前版本号
        current_versions = self.get_current_versions()
        print("\n📋 当前版本号:")
        for file, version in current_versions.items():
            print(f"  {file}: {version}")

        # 检查版本号是否一致
        unique_versions = set(current_versions.values())
        if len(unique_versions) > 1:
            print("\n⚠️  警告: 版本号不一致!")

        print("\n🔧 请选择操作:")
        print("1. 手动输入新版本号")
        print("2. 自动递增版本号")
        print("3. 退出")

        choice = input("\n请输入选择 (1-3): ").strip()

        if choice == '1':
            self.manual_version_input()
        elif choice == '2':
            self.auto_increment_version()
        elif choice == '3':
            print("👋 再见!")
            sys.exit(0)
        else:
            print("❌ 无效选择")
            self.run()

    def manual_version_input(self):
        """手动输入版本号"""
        while True:
            new_version = input("\n请输入新版本号 (例: 1.0.2): ").strip()

            if not new_version:
                print("❌ 版本号不能为空")
                continue

            if not self.validate_version(new_version):
                print("❌ 版本号格式无效，请使用语义化版本格式 (例: 1.0.2)")
                continue

            self.confirm_and_update(new_version)
            break

    def auto_increment_version(self):
        """自动递增版本号"""
        current_versions = self.get_current_versions()
        # 使用 package.json 的版本作为基准
        base_version = current_versions.get('package.json', '1.0.0')

        print(f"\n当前版本: {base_version}")
        print("请选择递增类型:")
        print("1. 主版本号 (major) - 重大更新")
        print("2. 次版本号 (minor) - 功能更新")
        print("3. 修订版本号 (patch) - 错误修复")

        increment_choice = input("请输入选择 (1-3): ").strip()

        increment_map = {
            '1': 'major',
            '2': 'minor',
            '3': 'patch'
        }

        if increment_choice not in increment_map:
            print("❌ 无效选择")
            return

        increment_type = increment_map[increment_choice]
        new_version = self.increment_version(base_version, increment_type)

        if new_version:
            print(f"\n新版本号: {new_version}")
            self.confirm_and_update(new_version)
        else:
            print("❌ 版本号格式错误")

    def confirm_and_update(self, new_version):
        """确认并更新版本号"""
        print(f"\n即将更新版本号为: {new_version}")
        confirm = input("确认更新? (y/N): ").strip().lower()

        if confirm in ['y', 'yes', '是']:
            try:
                self.update_package_json(new_version)
                self.update_tauri_conf(new_version)
                self.update_cargo_toml(new_version)
                print(f"\n🎉 版本号已成功更新为: {new_version}")
                print("\n💡 后续步骤:")
                print("   📦 构建项目: npm run tauri:build")
                print(f"   📝 编写发布说明: 更新 RELEASE_{new_version}.md")
                print("   📖 更新文档: 修改 README.md 版本信息")
                print("   🔖 提交并打标签:")
                print("      git add .")
                print(f"      git commit -m 'chore: bump version to {new_version}'")
                print(f"      git tag v{new_version}")
                print(f"      git push origin main && git push origin v{new_version}")
            except Exception as e:
                print(f"❌ 更新失败: {e}")
        else:
            print("❌ 已取消更新")

if __name__ == "__main__":
    updater = VersionUpdater()
    updater.run()
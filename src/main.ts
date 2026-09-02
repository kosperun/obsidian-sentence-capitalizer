import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, makeCapitalizeOnWordEnd } from './capitalize';
import type { SentenceCapitalizerSettings } from './capitalize';

class SentenceCapitalizerSettingTab extends PluginSettingTab {
	plugin: SentenceCapitalizerPlugin;

	constructor(plugin: SentenceCapitalizerPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Capitalize list items')
			.setDesc('Also auto-capitalize the first word of list and checkbox items, not just sentences.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.capitalizeListItems).onChange(async (value) => {
					this.plugin.settings.capitalizeListItems = value;
					await this.plugin.saveSettings();
				})
			);
	}
}

export default class SentenceCapitalizerPlugin extends Plugin {
	settings: SentenceCapitalizerSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SentenceCapitalizerSettingTab(this));
		this.registerEditorExtension(makeCapitalizeOnWordEnd(() => this.settings));
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<SentenceCapitalizerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}

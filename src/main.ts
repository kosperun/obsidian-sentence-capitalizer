import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { DEFAULT_SETTINGS, makeCapitalizeOnWordEnd } from './capitalize';
import type { SentenceCapitalizerSettings } from './capitalize';

const CAPITALIZE_LIST_ITEMS_DESC = 'Also auto-capitalize the first word of list and checkbox items, not just sentences.';

class SentenceCapitalizerSettingTab extends PluginSettingTab {
	plugin: SentenceCapitalizerPlugin;

	constructor(plugin: SentenceCapitalizerPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	// Obsidian 1.13+ reads this declaratively (and indexes it for settings
	// search); display() below is the fallback for older versions.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Capitalize list items',
				desc: CAPITALIZE_LIST_ITEMS_DESC,
				control: { type: 'toggle', key: 'capitalizeListItems' },
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof SentenceCapitalizerSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'capitalizeListItems') {
			this.plugin.settings.capitalizeListItems = value as boolean;
			await this.plugin.saveSettings();
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Capitalize list items')
			.setDesc(CAPITALIZE_LIST_ITEMS_DESC)
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

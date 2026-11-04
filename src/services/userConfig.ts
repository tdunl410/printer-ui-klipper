export interface TempPreset {
  id: string;
  name: string;
  nozzle: number;
  bed: number;
  chamber: number;
  fan: number;
}

export interface UiConfig {
  appearance: {
    theme: string;
    printerName: string;
    printerRender: string;
  };
  connection: {
    moonrakerBaseUrl?: string;
    websocketUrl?: string;
  };
  presets: {
    temperature: TempPreset[];
  };
  customizations: Record<string, unknown>;
}

export interface UiConfigPatch {
  appearance?: Partial<UiConfig['appearance']>;
  connection?: Partial<UiConfig['connection']>;
  presets?: Partial<UiConfig['presets']>;
  customizations?: Record<string, unknown>;
}

export const defaultTempPresets: TempPreset[] = [
  { id: 'pla', name: 'PLA', nozzle: 210, bed: 60, chamber: 0, fan: 50 },
  { id: 'abs', name: 'ABS', nozzle: 280, bed: 100, chamber: 80, fan: 30 },
  { id: 'cooldown', name: 'COOLDOWN', nozzle: 0, bed: 0, chamber: 1, fan: 0 },
];

export const defaultUiConfig: UiConfig = {
  appearance: {
    theme: 'purple',
    printerName: 'Printer',
    printerRender: '',
  },
  connection: {},
  presets: {
    temperature: defaultTempPresets,
  },
  customizations: {},
};

const mergeUiConfig = (base: UiConfig, incoming: UiConfigPatch | undefined): UiConfig => {
  if (!incoming) return base;

  return {
    appearance: {
      ...base.appearance,
      ...(incoming.appearance ?? {}),
    },
    connection: {
      ...base.connection,
      ...(incoming.connection ?? {}),
    },
    presets: {
      ...base.presets,
      ...(incoming.presets ?? {}),
      temperature: Array.isArray(incoming.presets?.temperature)
        ? incoming.presets.temperature
        : base.presets.temperature,
    },
    customizations: {
      ...base.customizations,
      ...(incoming.customizations ?? {}),
    },
  };
};

export async function getUiConfig() {
  const response = await fetch('/api/ui/config');
  if (!response.ok) {
    throw new Error(`Config request failed (${response.status})`);
  }

  const payload = (await response.json()) as { config?: UiConfigPatch };
  return mergeUiConfig(defaultUiConfig, payload.config);
}

export async function patchUiConfig(patch: UiConfigPatch) {
  const response = await fetch('/api/ui/config', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Config update failed (${response.status})`);
  }

  const payload = (await response.json()) as { config?: UiConfigPatch };
  return mergeUiConfig(defaultUiConfig, payload.config);
}

const settingsService = require('../services/settings-service');

function handleRouteError(reply, error) {
  reply.code(400).send({ error: error.message });
}

function pickSettingsPayload(body = {}) {
  return {
    storageDestination: body.storageDestination,
    localMediaDirectory: body.localMediaDirectory,
    transcriptionMode: body.transcriptionMode,
    providerKind: body.providerKind,
    backendApiKey: body.backendApiKey,
    clearBackendApiKey: body.clearBackendApiKey,
  };
}

async function registerSettingsRoutes(app) {
  app.get('/api/v1/settings', async () => {
    return settingsService.getSettings();
  });

  app.put('/api/v1/settings', async (request, reply) => {
    try {
      return await settingsService.updateStoredSettings(pickSettingsPayload(request.body));
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerSettingsRoutes,
};

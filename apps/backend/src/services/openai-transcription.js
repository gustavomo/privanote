const fs = require('fs');
const path = require('path');
const { Blob } = require('buffer');

const openAiModel = 'gpt-4o-mini-transcribe';
const openAiMaxFileSize = 25 * 1024 * 1024;
const supportedExtensions = new Set(['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']);

function normalizeOpenAiError(error, fallbackMessage = 'OpenAI transcription failed.') {
  const statusCode = Number(error?.statusCode || error?.status) || 400;
  const errorMessage = String(error?.message || '').trim();

  if (statusCode === 401 || statusCode === 403) {
    const authError = new Error('OpenAI API key is invalid.');
    authError.statusCode = 400;
    return authError;
  }

  const normalizedError = new Error(errorMessage || fallbackMessage);
  normalizedError.statusCode = statusCode;
  return normalizedError;
}

function assertOpenAiAttachmentSupported(attachmentPath) {
  const safeAttachmentPath = String(attachmentPath || '').trim();
  if (!safeAttachmentPath) {
    throw normalizeOpenAiError(new Error('Attachment path is required.'));
  }

  if (!fs.existsSync(safeAttachmentPath)) {
    throw normalizeOpenAiError(new Error('Attachment file not found.'));
  }

  const extension = path.extname(safeAttachmentPath).toLowerCase();
  if (!supportedExtensions.has(extension)) {
    throw normalizeOpenAiError(
      new Error('OpenAI transcription only supports .mp3, .mp4, .mpeg, .mpga, .m4a, .wav, and .webm files.')
    );
  }

  const stats = fs.statSync(safeAttachmentPath);
  if (stats.size > openAiMaxFileSize) {
    throw normalizeOpenAiError(new Error('OpenAI transcription only supports files up to 25 MB.'));
  }

  return {
    attachmentPath: safeAttachmentPath,
    extension,
    size: stats.size,
  };
}

async function validateOpenAiKey(apiKey) {
  const safeApiKey = String(apiKey || '').trim();
  if (!safeApiKey) {
    throw normalizeOpenAiError(new Error('OpenAI API key is required for Backend transcription mode.'));
  }

  if (typeof fetch !== 'function') {
    throw normalizeOpenAiError(new Error('OpenAI validation is unavailable in this runtime.'), 'OpenAI validation failed.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${safeApiKey}`,
      },
    });

    if (!response.ok) {
      let body = null;

      try {
        body = await response.json();
      } catch (_error) {
        body = null;
      }

      const message =
        body?.error?.message || body?.message || `OpenAI validation failed with status ${response.status}.`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }

    return {
      valid: true,
      providerKind: 'openai',
    };
  } catch (error) {
    throw normalizeOpenAiError(error, 'OpenAI validation failed.');
  }
}

async function transcribeWithOpenAi({ attachmentPath, apiKey }) {
  const supportedAttachment = assertOpenAiAttachmentSupported(attachmentPath);

  if (typeof fetch !== 'function' || typeof FormData === 'undefined') {
    throw normalizeOpenAiError(
      new Error('OpenAI transcription is unavailable in this runtime.'),
      'OpenAI transcription failed.'
    );
  }

  const safeApiKey = String(apiKey || '').trim();
  if (!safeApiKey) {
    throw normalizeOpenAiError(new Error('OpenAI API key is required for Backend transcription mode.'));
  }

  const buffer = fs.readFileSync(supportedAttachment.attachmentPath);
  const formData = new FormData();
  formData.append('model', openAiModel);
  formData.append(
    'file',
    new Blob([buffer], {
      type: 'application/octet-stream',
    }),
    path.basename(supportedAttachment.attachmentPath)
  );

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${safeApiKey}`,
      },
      body: formData,
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      body = null;
    }

    if (!response.ok) {
      const error = new Error(
        body?.error?.message || body?.message || `OpenAI transcription failed with status ${response.status}.`
      );
      error.statusCode = response.status;
      throw error;
    }

    const text = String(body?.text || '').trim();
    if (!text) {
      throw new Error('OpenAI transcription returned an empty transcript.');
    }

    return text;
  } catch (error) {
    throw normalizeOpenAiError(error, 'OpenAI transcription failed.');
  }
}

module.exports = {
  openAiModel,
  openAiMaxFileSize,
  assertOpenAiAttachmentSupported,
  validateOpenAiKey,
  transcribeWithOpenAi,
  normalizeOpenAiError,
};

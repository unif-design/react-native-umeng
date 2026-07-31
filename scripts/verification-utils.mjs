import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isDirectExecution(importMetaUrl) {
  return (
    typeof process.argv[1] === 'string' &&
    resolve(process.argv[1]) === fileURLToPath(importMetaUrl)
  );
}

export async function finalizeTempVerification({
  log = console.log,
  preserveOnFailure = false,
  primaryError,
  remove = (tempPath) => rm(tempPath, { recursive: true, force: true }),
  stage,
  successMessage,
  tempPath,
}) {
  if (primaryError && preserveOnFailure) {
    throw new Error(
      [
        `Verification failed during "${stage}". Temp path preserved at:`,
        tempPath,
        errorMessage(primaryError),
      ].join('\n'),
      { cause: primaryError }
    );
  }

  let cleanupError;
  try {
    await remove(tempPath);
  } catch (error) {
    cleanupError = error;
  }

  if (cleanupError) {
    const cleanupDetails = [
      `Cleanup failed during "${stage}" for temp path:`,
      tempPath,
      errorMessage(cleanupError),
    ].join('\n');

    if (primaryError) {
      throw new Error(
        [errorMessage(primaryError), cleanupDetails].join('\n'),
        { cause: primaryError }
      );
    }

    throw new Error(cleanupDetails, { cause: cleanupError });
  }

  if (primaryError) {
    throw primaryError;
  }

  if (successMessage) {
    log(successMessage);
  }
}

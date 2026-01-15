import { getDriveClient, getSlidesClient } from './credentials';
import type { PlaceholderMap } from './types';

export async function copyTemplate(
  templateId: string,
  clienteName: string,
  folderId?: string
): Promise<{ presentationId: string; presentationUrl: string }> {
  const drive = getDriveClient();
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const fileName = `Relatório ${clienteName} - ${dateStr}`;

  const copyResponse = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
  });

  const presentationId = copyResponse.data.id!;
  const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  return { presentationId, presentationUrl };
}

export async function fillPlaceholders(
  presentationId: string,
  placeholders: PlaceholderMap
): Promise<void> {
  const slides = getSlidesClient();

  const requests: any[] = [];

  for (const [key, value] of Object.entries(placeholders)) {
    const placeholder = `{{${key}}}`;
    const textValue = String(value);

    requests.push({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: false,
        },
        replaceText: textValue,
      },
    });
  }

  if (requests.length === 0) return;

  const batchSize = 50;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: batch,
      },
    });
  }
}

export async function replaceImage(
  presentationId: string,
  imageObjectId: string,
  imageUrl: string
): Promise<void> {
  const slides = getSlidesClient();

  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests: [
        {
          replaceImage: {
            imageObjectId,
            url: imageUrl,
            imageReplaceMethod: 'CENTER_CROP',
          },
        },
      ],
    },
  });
}

export async function deleteSlide(
  presentationId: string,
  slideObjectId: string
): Promise<void> {
  const slides = getSlidesClient();

  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: {
      requests: [
        {
          deleteObject: {
            objectId: slideObjectId,
          },
        },
      ],
    },
  });
}

export async function getSlideObjectIds(
  presentationId: string
): Promise<{ slideId: string; elements: { objectId: string; type: string; name?: string }[] }[]> {
  const slides = getSlidesClient();

  const presentation = await slides.presentations.get({
    presentationId,
  });

  const result: { slideId: string; elements: { objectId: string; type: string; name?: string }[] }[] = [];

  for (const slide of presentation.data.slides || []) {
    const elements: { objectId: string; type: string; name?: string }[] = [];

    for (const element of slide.pageElements || []) {
      if (element.image) {
        elements.push({
          objectId: element.objectId!,
          type: 'image',
          name: element.title || undefined,
        });
      } else if (element.shape?.shapeType === 'TEXT_BOX') {
        elements.push({
          objectId: element.objectId!,
          type: 'textbox',
        });
      }
    }

    result.push({
      slideId: slide.objectId!,
      elements,
    });
  }

  return result;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  try {
    const targetUrl = process.env.GAS_URL;

    if (!targetUrl) {
      return response.status(500).json({
        error: 'Не настроен URL сервиса'
      });
    }

    const payload = request.body;

    const externalResponse = await fetch(targetUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await externalResponse.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        message: responseText
      };
    }

    if (!externalResponse.ok) {
      return response.status(502).json({
        error: 'Ошибка внешнего сервиса',
        status: externalResponse.status,
        data
      });
    }

    return response.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    return response.status(500).json({
      error: error.message
    });
  }
}

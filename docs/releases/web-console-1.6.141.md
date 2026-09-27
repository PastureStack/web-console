# Web Console 1.6.141

Direct ProjectTemplate edit URLs now present a readable missing-or-denied message when the template is not owned by the signed-in account or the API responds with 403 or 404. The page uses the same visible 404 response for both cases, with English and Traditional Chinese text that follows a locale change. An API 401 still reaches the existing session recovery flow. The Server remains the authorization authority.

The API-key modal now displays a failed save through its existing error handler. A denied creation shows the API error while keeping the modal open; it does not display public or secret key values. Error text returned by the API is displayed as received, so this patch does not claim that every server error is translated.

This patch does not change resource mutations, permission grants, the published 1.6.140 archive, or any deployed Server image. Its local tests cover the direct route decisions, both message locales, and a denied API-key save.

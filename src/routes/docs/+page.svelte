<script>
  import { onMount } from "svelte";

  let response; // Declare a reactive variable for the API response
  let parsedContent = []; // Declare a reactive variable for the parsed content

  // Function to extract and parse the content
  const extractContent = (data) => {
    if (!data) return [];
    console.log(data);

    const content = data.body?.content || [];
    const inlineObjects = data.inlineObjects || {};
    const lists = data.lists || {};

    const parsed = [];
    let currentList = null;

    for (const block of content) {
      const paragraph = block?.paragraph;

      if (!paragraph || !paragraph.elements) continue;

      // Handle lists
      if (paragraph.bullet) {
        const listId = paragraph.bullet.listId;
        const isOrdered = lists[listId]?.listProperties?.nestingLevels?.[0]?.glyphType === "DECIMAL";
        const listType = isOrdered ? "ol" : "ul";

        if (currentList && currentList.listId === listId) {
          currentList.items.push(paragraph.elements);
        } else {
          if (currentList) parsed.push(currentList);
          currentList = { type: listType, listId: listId, items: [paragraph.elements] };
        }
      } else {
        let hasInlineObject = false;

        for (const element of paragraph.elements) {
          if (element.inlineObjectElement) {
            const inlineObjectId = element.inlineObjectElement.inlineObjectId;
            const inlineObject = inlineObjects[inlineObjectId];
            const embeddedObject = inlineObject?.inlineObjectProperties?.embeddedObject;
            const image = embeddedObject?.imageProperties;

            if (image) {
              parsed.push({
                type: "image",
                src: image.contentUri,
                alt: "Embedded Image",
                width: image.size?.width?.magnitude || 100,
                height: image.size?.height?.magnitude || 100,
              });
              hasInlineObject = true;
            }
          }
        }

        if (!hasInlineObject) {
          const textElements = paragraph.elements
            .map((el) => el?.textRun?.content || "")
            .join("")
            .trim();

          if (textElements) {
            parsed.push({ type: "p", content: paragraph.elements });
          }
        }
      }
    }

    if (currentList) parsed.push(currentList);
    return parsed;
  };

  // Fetch the document content on mount
  onMount(async () => {
    try {
      const docId = "1pS0tgwZquiHhn0PKT0KxGrfRw8Og61FD4VTx4XCvWPg";
      const userId = "12345";
      const res = await fetch(`http://localhost:3000/google-doc?documentId=${docId}&userId=${userId}`, {
        method: "GET",
      });
      const res2 = await res.json();

      response = res2.data; // Update the response variable
      parsedContent = extractContent(response); // Parse the content after fetching the response
    } catch (error) {
      console.error("Error fetching document:", error);
    }
  });
</script>

<div class="min-h-screen bg-gray-100 flex justify-center items-center py-10">
  <!-- Document Container -->
  <div class="bg-white w-[8.5in] h-[11in] shadow-lg border border-gray-300 p-8 rounded-md overflow-auto">

    <!-- Render Content -->
    <div class="space-y-4">
      {#each parsedContent as block}
        {#if block.type === "p"}
          <p class="text-base leading-6">
            {#each block.content as element}
              <span
                class={`${
                  element.textRun?.textStyle?.bold ? "font-bold" : ""
                } ${
                  element.textRun?.textStyle?.italic ? "italic" : ""
                } ${
                  element.textRun?.textStyle?.underline ? "underline" : ""
                }`}
                style={`font-size: ${
                  element.textRun?.textStyle?.fontSize?.magnitude || 16
                }px; color: ${
                  element.textRun?.textStyle?.foregroundColor?.color?.rgbColor
                    ? `rgb(${Math.round(
                        element.textRun.textStyle.foregroundColor.color.rgbColor.red * 255 || 0
                      )}, ${Math.round(
                        element.textRun.textStyle.foregroundColor.color.rgbColor.green * 255 || 0
                      )}, ${Math.round(
                        element.textRun.textStyle.foregroundColor.color.rgbColor.blue * 255 || 0
                      )})`
                    : "inherit"
                }`}>
                {#if element.textRun?.textStyle?.link?.url}
                  <a href={element.textRun.textStyle.link.url} target="_blank">
                    {element.textRun.content}
                  </a>
                {:else}
                  {element.textRun.content}
                {/if}
              </span>
            {/each}
          </p>
        {:else if block.type === "ol"}
          <ol class="list-decimal ml-8">
            {#each block.items as listItem}
              <li>
                {#each listItem as element}
                  <span
                    class={`${
                      element.textRun?.textStyle?.bold ? "font-bold" : ""
                    } ${
                      element.textRun?.textStyle?.italic ? "italic" : ""
                    } ${
                      element.textRun?.textStyle?.underline ? "underline" : ""
                    }`}
                    style={`font-size: ${
                      element.textRun?.textStyle?.fontSize?.magnitude || 16
                    }px; color: ${
                      element.textRun?.textStyle?.foregroundColor?.color?.rgbColor
                        ? `rgb(${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.red * 255 || 0
                          )}, ${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.green * 255 || 0
                          )}, ${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.blue * 255 || 0
                          )})`
                        : "inherit"
                    }`}>
                    {element.textRun.content}
                  </span>
                {/each}
              </li>
            {/each}
          </ol>
        {:else if block.type === "ul"}
          <ul class="list-disc ml-8">
            {#each block.items as listItem}
              <li>
                {#each listItem as element}
                  <span
                    class={`${
                      element.textRun?.textStyle?.bold ? "font-bold" : ""
                    } ${
                      element.textRun?.textStyle?.italic ? "italic" : ""
                    } ${
                      element.textRun?.textStyle?.underline ? "underline" : ""
                    }`}
                    style={`font-size: ${
                      element.textRun?.textStyle?.fontSize?.magnitude || 16
                    }px; color: ${
                      element.textRun?.textStyle?.foregroundColor?.color?.rgbColor
                        ? `rgb(${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.red * 255 || 0
                          )}, ${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.green * 255 || 0
                          )}, ${Math.round(
                            element.textRun.textStyle.foregroundColor.color.rgbColor.blue * 255 || 0
                          )})`
                        : "inherit"
                    }`}>
                    {element.textRun.content}
                  </span>
                {/each}
              </li>
            {/each}
          </ul>
        {:else if block.type === "image"}
          <img
            src={block.src}
            alt={block.alt}
            width={block.width}
            height={block.height}
            class="mx-auto my-4"
          />
        {/if}
      {/each}
    </div>
  </div>
</div>

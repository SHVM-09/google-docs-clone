<script>
    import ProseMirrorEditor from "$lib/components/ProseMirrorEditor.svelte";
    import "prosemirror-view/style/prosemirror.css";
  </script>
  
  <main class="bg-[#f9fbfd] min-h-screen flex flex-col items-center justify-center py-4">
    <h1 class="mt-1 text-xl font-medium text-center">Prosemirror Google Doc Editor</h1>
    <div class="max-w-[800px] w-full">
        <ProseMirrorEditor />
    </div>
  </main>
  
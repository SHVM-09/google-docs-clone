<script>
import { goto } from "$app/navigation";
</script>

<button on:click={() => window.location='https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=803908189919-10hvv1f1u0k7ufbr2o8fefk038fkubbe.apps.googleusercontent.com&redirect_uri=http://localhost:5173/auth/google/callback&scope=openid%20email%20profile%20https://www.googleapis.com/auth/documents%20https://www.googleapis.com/auth/documents.readonly%20https://www.googleapis.com/auth/drive%20https://www.googleapis.com/auth/drive.readonly%20https://www.googleapis.com/auth/drive.file&access_type=offline&prompt=consent'} class="bg-blue-500 text-white rounded absolute top-1/2 left-1/2 p-4 py-2 -translate-x-1/2">Click me</button>
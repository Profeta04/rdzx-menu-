import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import {
  assertAllowedUpstream,
  buildRotatedHeaders,
  buildRotatedStorageHeaders,
  fetchWithRetry,
  mapLovableError,
  maskToken,
} from "../_shared/lovable.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
     const { fileBase64, fileName, contentType, projeto_id, token_lovable, license_key } = await req.json()

    if (!fileBase64) {
      throw new Error('No file data provided')
    }

     if (!projeto_id || !token_lovable || !license_key) {
       throw new Error('projeto_id, token_lovable and license_key are required')
     }
 
     // Hard-validation of license
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     const { data: license, error: licenseError } = await supabase
       .from("licenses")
       .select("status")
       .eq("license_key", license_key)
       .single();
 
     if (licenseError || !license || license.status !== 'active') {
       throw new Error('Licença inválida ou inativa');
     }
 
     const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
     // Reject oversized payloads BEFORE allocating bytes (base64 ≈ 4/3 of binary size)
     const approxBytes = Math.floor((base64Data.length * 3) / 4);
     if (approxBytes > MAX_FILE_BYTES) {
       return new Response(
         JSON.stringify({ error: `Arquivo excede ${MAX_FILE_BYTES / 1024 / 1024} MB` }),
         { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
    const binary = atob(base64Data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

     // 1. Generate Upload URL (Lovable API)
     const genUploadUrl = `https://api.lovable.dev/projects/${projeto_id}/files/generate-upload-url`;
     assertAllowedUpstream(genUploadUrl, "lovable");
     const genUploadResp = await fetchWithRetry(genUploadUrl, {
       method: 'POST',
       headers: buildRotatedHeaders(token_lovable),
       body: JSON.stringify({
         content_type: contentType || 'image/png',
         original_file_name: fileName,
         file_size_bytes: bytes.length,
         original_file_size_bytes: bytes.length
       })
     }, 3);
 
     if (!genUploadResp.ok) {
       const errText = await genUploadResp.text();
       const mapped = mapLovableError(genUploadResp.status, errText);
       console.warn(`[uf] event=generate_upload_url_failed status=${genUploadResp.status} code=${mapped.error_code} license=${maskToken(license_key)}`);
       return new Response(JSON.stringify(mapped), {
         status: genUploadResp.status,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     const uploadConfig = await genUploadResp.json();
     const { url: uploadUrl, file_id, headers: uploadHeaders } = uploadConfig;
 
     // 2. Upload to the signed URL (storage host — separate allowlist)
     assertAllowedUpstream(uploadUrl, "storage");
     const uploadResp = await fetchWithRetry(uploadUrl, {
       method: 'PUT',
       headers: {
         ...buildRotatedStorageHeaders(),
         ...(uploadHeaders || {}),
         'Content-Type': contentType || 'image/png',
       },
       body: bytes
     }, 3);
 
     if (!uploadResp.ok) {
       const errText = await uploadResp.text();
       console.warn(`[uf] event=signed_put_failed status=${uploadResp.status}`);
       return new Response(
         JSON.stringify({ error_code: "STORAGE_UPLOAD_FAILED", error_display: "Falha no upload do arquivo", details: errText.slice(0, 200) }),
         { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // 3. Generate Download URL (Optimistic Preview)
     const [dirName, ...rest] = file_id.split('/');
     const fileNameOnly = rest.join('/');
 
     const genDownloadUrl = `https://api.lovable.dev/files/generate-download-url`;
     assertAllowedUpstream(genDownloadUrl, "lovable");
     const genDownloadResp = await fetchWithRetry(genDownloadUrl, {
       method: 'POST',
       headers: buildRotatedHeaders(token_lovable),
       body: JSON.stringify({ dir_name: dirName, file_name: fileNameOnly })
     }, 3);
 
     const downloadUrlData = genDownloadResp.ok ? await genDownloadResp.json() : { url: null };
 
     return new Response(
       JSON.stringify({ 
         file_id, 
         optimisticImageUrl: downloadUrlData.url,
         fileName,
         contentType
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     )
  } catch (error) {
    console.error("[uf] error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: "Erro ao processar upload" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

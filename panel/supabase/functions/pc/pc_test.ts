 import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
 const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
 const PROJECT_REF = "cvbgrjauqjawrsyknhyj";
 const FUNC_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/pc`; 
 
 Deno.test({
   name: "pc: request without device_id returns 403 and logs missing_device_id",
   async fn() {
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
     
     // 1. Setup: Garantir que temos uma licença ativa para testar
     const testLicense = "TEST-PC-AUTH-123";
     await supabase.from("licenses").upsert({
       license_key: testLicense,
       status: "active",
       device_id: "VALID-HWID-EXISTING"
     }, { onConflict: "license_key" });
 
     // 2. Executar request sem device_id
     const payload = {
       license_key: testLicense,
       projeto_id: "clne_test_project_id",
       mensagem: "Hello from test"
     };
 
     const response = await fetch(FUNC_URL, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload)
     });
 
     // 3. Validar 403
     assertEquals(response.status, 403);
     const body = await response.json();
     assertEquals(body.message, "Acesso negado");
 
     // 4. Validar registro no fraud_events
     const { data: events, error } = await supabase
       .from("fraud_events")
       .select("*")
       .eq("license_key", testLicense)
       .eq("event_type", "missing_device_id")
       .order("created_at", { ascending: false })
       .limit(1);
 
     assertEquals(error, null);
     assertEquals(events?.length, 1, "Deveria ter registrado um evento missing_device_id");
   },
   sanitizeResources: false,
   sanitizeOps: false,
 });
 
 Deno.test({
   name: "pc: request with invalid/short device_id returns 403 and logs suspicious_device_id",
   async fn() {
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
     const testLicense = "TEST-PC-AUTH-SUSPICIOUS";
     
     await supabase.from("licenses").upsert({
       license_key: testLicense,
       status: "active",
       device_id: "VALID-HWID-EXISTING"
     }, { onConflict: "license_key" });
 
     const payload = {
       license_key: testLicense,
       projeto_id: "clne_test_project_id",
       mensagem: "Hello from test suspicious",
       device_id: "too-short"
     };
 
     const response = await fetch(FUNC_URL, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload)
     });
 
     assertEquals(response.status, 403);
     const { data: events } = await supabase
       .from("fraud_events")
       .select("*")
       .eq("license_key", testLicense)
       .eq("event_type", "suspicious_device_id")
       .limit(1);
 
     assertEquals(events?.length, 1, "Deveria ter registrado um evento suspicious_device_id");
   },
   sanitizeResources: false,
   sanitizeOps: false,
 });
 
 Deno.test({
   name: "pc: rate limit by license_key blocks excessive requests",
   async fn() {
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
     const testLicense = "TEST-PC-RATE-LIMIT";
     const devId = "A".repeat(64); // Valid length
 
     await supabase.from("licenses").upsert({
       license_key: testLicense,
       status: "active",
       device_id: devId
     }, { onConflict: "license_key" });
 
     // Limpa rate limits antigos para o teste ser determinístico
     await supabase.from("rate_limits_license")
       .delete()
       .eq("license_key", testLicense);
 
     const payload = {
       license_key: testLicense,
       projeto_id: "clne_test_project_id",
       mensagem: "Hello from rate limit test",
       device_id: devId
     };
 
     // Faz 20 requisições (limite é 20)
     // Nota: Como estamos chamando a função real que faz fetch externo, 
     // o teste pode ser lento ou bater no rate limit do IP do sandbox.
     // No entanto, o rate limit da licença acontece ANTES do fetch externo.
     for (let i = 0; i < 20; i++) {
       await fetch(FUNC_URL, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload)
       });
     }
 
     // A 21ª requisição deve retornar 429
     const response = await fetch(FUNC_URL, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload)
     });
 
     assertEquals(response.status, 429, "A 21ª requisição deve ser bloqueada por rate limit");
     const body = await response.json();
     assertEquals(body.message, "Muitas requisições para esta licença. Aguarde um momento.");
   },
   sanitizeResources: false,
   sanitizeOps: false,
 });
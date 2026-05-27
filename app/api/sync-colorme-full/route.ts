import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COLORME_API = "https://api.shop-pro.jp/v1";
const LIMIT = 100;

function normalizeSku(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const startedAt = new Date().toISOString();

  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "COLORME_ACCESS_TOKEN is missing" },
        { status: 500 }
      );
    }

    const syncRunId = crypto.randomUUID();
    let offset = 0;
    let fetchedProducts = 0;
    let updatedRows = 0;
    let zeroedRows = 0;

    while (true) {
      const url = `${COLORME_API}/products.json?limit=${LIMIT}&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ColorMe API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const products = Array.isArray(json.products) ? json.products : [];

      if (products.length === 0) break;

      fetchedProducts += products.length;

      const rows: any[] = [];

      for (const product of products) {
        const productId = String(product.id ?? "");
        const productName = String(product.name ?? "");
        const imageUrl =
          product.image_url ||
          product.thumbnail_image_url ||
          product.image?.src ||
          null;

        const variants = Array.isArray(product.variants)
          ? product.variants
          : Array.isArray(product.options)
          ? product.options
          : [];

        if (variants.length > 0) {
          for (const variant of variants) {
            const sku = normalizeSku(
              variant.sku || variant.model_number || variant.product_code
            );

            if (!sku) continue;

            rows.push({
              product_id: productId,
              option_id: String(variant.id ?? ""),
              sku,
              product_name: productName,
              option_name: String(
                variant.name ||
                  variant.option_name ||
                  variant.title ||
                  ""
              ),
              barcode: variant.barcode || null,
              image_url: imageUrl,
              colorme_stock: toNumber(
                variant.stock ?? variant.stocks ?? variant.inventory_quantity
              ),
              has_option: true,
              is_active: true,
              full_sync_run_id: syncRunId,
              full_synced_at: startedAt,
              updated_at: startedAt,
            });
          }
        } else {
          const sku = normalizeSku(
            product.sku || product.model_number || product.product_code
          );

          if (!sku) continue;

          rows.push({
            product_id: productId,
            option_id: null,
            sku,
            product_name: productName,
            option_name: null,
            barcode: product.barcode || null,
            image_url: imageUrl,
            colorme_stock: toNumber(
              product.stock ?? product.stocks ?? product.inventory_quantity
            ),
            has_option: false,
            is_active: true,
            full_sync_run_id: syncRunId,
            full_synced_at: startedAt,
            updated_at: startedAt,
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("products").upsert(rows, {
          onConflict: "sku",
        });

        if (error) {
          throw new Error(`Supabase upsert error: ${error.message}`);
        }

        updatedRows += rows.length;
      }

      if (products.length < LIMIT) break;
      offset += LIMIT;
    }

    const { error: zeroError, count } = await supabase
      .from("products")
      .update({
        colorme_stock: 0,
        full_synced_at: startedAt,
        updated_at: startedAt,
      })
      .neq("full_sync_run_id", syncRunId)
      .eq("is_active", true)
      .select("id", { count: "exact" });

    if (zeroError) {
      throw new Error(`Zero missing products error: ${zeroError.message}`);
    }

    zeroedRows = count ?? 0;

    return NextResponse.json({
      ok: true,
      mode: "full",
      startedAt,
      finishedAt: new Date().toISOString(),
      syncRunId,
      fetchedProducts,
      updatedRows,
      zeroedRows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "sync-colorme-full failed",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

/**
 * Standalone testimony submission is paused. New testimonies must be created
 * from a case or person file so a parent record can be attached.
 */
export async function POST() {
  return NextResponse.json(
    { error: "تُضاف الشهادات من داخل القضية أو ملف الشخص المرتبط بها بعد تفعيل الحسابات." },
    { status: 410 },
  );
}

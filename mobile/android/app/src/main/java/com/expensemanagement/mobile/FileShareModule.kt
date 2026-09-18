package com.expensemanagement.mobile

import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FileShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FileShareModule"

    @ReactMethod
    fun shareFile(fileName: String, content: String, mimeType: String, dialogTitle: String, promise: Promise) {
        try {
            val exportDir = File(reactContext.cacheDir, "exports")
            if (!exportDir.exists()) {
                exportDir.mkdirs()
            }
            val file = File(exportDir, fileName)
            FileOutputStream(file).use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
            }

            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, dialogTitle).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun sharePdf(
        fileName: String,
        title: String,
        currencySymbol: String,
        itemsJsonStr: String,
        totalIncomeStr: String,
        totalExpenseStr: String,
        netCashflowStr: String,
        dialogTitle: String,
        promise: Promise
    ) {
        try {
            val items = JSONArray(itemsJsonStr)
            val pdfDocument = PdfDocument()
            val pageWidth = 595
            val pageHeight = 842
            val margin = 36f
            var pageNumber = 1

            var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            var page = pdfDocument.startPage(pageInfo)
            var canvas = page.canvas

            val paint = Paint()
            paint.isAntiAlias = true

            fun drawHeader() {
                paint.color = Color.parseColor("#1E293B")
                canvas.drawRect(0f, 0f, pageWidth.toFloat(), 80f, paint)

                paint.color = Color.WHITE
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                paint.textSize = 18f
                canvas.drawText("SPENDING BOOK", margin, 38f, paint)

                paint.textSize = 10f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                paint.color = Color.parseColor("#CBD5E1")
                canvas.drawText(title, margin, 56f, paint)

                val dateStr = "Generated: " + SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date())
                paint.textSize = 8.5f
                val dateWidth = paint.measureText(dateStr)
                canvas.drawText(dateStr, pageWidth - margin - dateWidth, 56f, paint)
            }

            fun drawSummaryCards(yTop: Float): Float {
                val cardWidth = (pageWidth - (margin * 2) - 20) / 3f
                val cardHeight = 44f

                // Income Card
                paint.color = Color.parseColor("#E8F5E9")
                canvas.drawRoundRect(margin, yTop, margin + cardWidth, yTop + cardHeight, 6f, 6f, paint)
                paint.color = Color.parseColor("#2E7D32")
                paint.textSize = 8f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                canvas.drawText("TOTAL INCOME", margin + 8f, yTop + 16f, paint)
                paint.textSize = 11f
                canvas.drawText(totalIncomeStr, margin + 8f, yTop + 34f, paint)

                // Expense Card
                val expX = margin + cardWidth + 10f
                paint.color = Color.parseColor("#FFEBEE")
                canvas.drawRoundRect(expX, yTop, expX + cardWidth, yTop + cardHeight, 6f, 6f, paint)
                paint.color = Color.parseColor("#C62828")
                paint.textSize = 8f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                canvas.drawText("TOTAL EXPENSES", expX + 8f, yTop + 16f, paint)
                paint.textSize = 11f
                canvas.drawText(totalExpenseStr, expX + 8f, yTop + 34f, paint)

                // Net Cashflow Card
                val netX = expX + cardWidth + 10f
                paint.color = Color.parseColor("#EDE7F6")
                canvas.drawRoundRect(netX, yTop, netX + cardWidth, yTop + cardHeight, 6f, 6f, paint)
                paint.color = Color.parseColor("#4527A0")
                paint.textSize = 8f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                canvas.drawText("NET CASHFLOW", netX + 8f, yTop + 16f, paint)
                paint.textSize = 11f
                canvas.drawText(netCashflowStr, netX + 8f, yTop + 34f, paint)

                return yTop + cardHeight + 16f
            }

            fun drawTableHeader(y: Float): Float {
                paint.color = Color.parseColor("#F1F5F9")
                canvas.drawRect(margin, y, pageWidth - margin, y + 20f, paint)

                paint.color = Color.parseColor("#475569")
                paint.textSize = 8.5f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)

                canvas.drawText("DATE", margin + 6f, y + 14f, paint)
                canvas.drawText("TYPE", margin + 70f, y + 14f, paint)
                canvas.drawText("CATEGORY / DETAILS", margin + 115f, y + 14f, paint)
                canvas.drawText("WALLET", margin + 350f, y + 14f, paint)

                val amtHeader = "AMOUNT"
                val w = paint.measureText(amtHeader)
                canvas.drawText(amtHeader, pageWidth - margin - 6f - w, y + 14f, paint)

                return y + 22f
            }

            drawHeader()
            var currentY = drawSummaryCards(95f)
            currentY = drawTableHeader(currentY)

            val rowHeight = 20f

            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                if (currentY + rowHeight > pageHeight - margin - 20f) {
                    // Page footer
                    paint.color = Color.parseColor("#94A3B8")
                    paint.textSize = 8f
                    paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                    val pageStr = "Page $pageNumber"
                    canvas.drawText(pageStr, pageWidth - margin - paint.measureText(pageStr), pageHeight - 15f, paint)

                    pdfDocument.finishPage(page)
                    pageNumber++
                    pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                    page = pdfDocument.startPage(pageInfo)
                    canvas = page.canvas

                    // Continuation mini header
                    paint.color = Color.parseColor("#1E293B")
                    canvas.drawRect(0f, 0f, pageWidth.toFloat(), 28f, paint)
                    paint.color = Color.WHITE
                    paint.textSize = 9.5f
                    paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                    canvas.drawText("SPENDING BOOK — Continued", margin, 18f, paint)

                    currentY = drawTableHeader(40f)
                }

                // Zebra row striping
                if (i % 2 == 1) {
                    paint.color = Color.parseColor("#F8FAFC")
                    canvas.drawRect(margin, currentY, pageWidth - margin, currentY + rowHeight, paint)
                }

                val isIncome = item.optString("type") == "INCOME"
                val date = item.optString("date")
                val category = item.optString("categoryName")
                val payee = item.optString("payeeOrSource")
                val wallet = item.optString("walletName")
                val cents = item.optLong("amountCents", 0)
                val formattedAmt = String.format(Locale.US, "%s %.2f", currencySymbol, cents / 100.0)

                // Date
                paint.color = Color.parseColor("#64748B")
                paint.textSize = 8f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                canvas.drawText(date, margin + 6f, currentY + 13f, paint)

                // Type
                paint.color = if (isIncome) Color.parseColor("#2E7D32") else Color.parseColor("#C62828")
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                canvas.drawText(if (isIncome) "INC" else "EXP", margin + 70f, currentY + 13f, paint)

                // Category & Details
                paint.color = Color.parseColor("#0F172A")
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                val catText = if (payee.isNotEmpty() && payee != category) "$category ($payee)" else category
                val truncatedCat = if (catText.length > 40) catText.substring(0, 37) + "..." else catText
                canvas.drawText(truncatedCat, margin + 115f, currentY + 13f, paint)

                // Wallet
                paint.color = Color.parseColor("#64748B")
                val truncatedWallet = if (wallet.length > 18) wallet.substring(0, 16) + "..." else wallet
                canvas.drawText(truncatedWallet, margin + 350f, currentY + 13f, paint)

                // Amount
                paint.color = if (isIncome) Color.parseColor("#2E7D32") else Color.parseColor("#C62828")
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                val amtText = (if (isIncome) "+" else "-") + formattedAmt
                val amtWidth = paint.measureText(amtText)
                canvas.drawText(amtText, pageWidth - margin - 6f - amtWidth, currentY + 13f, paint)

                // Row underline
                paint.color = Color.parseColor("#F1F5F9")
                paint.strokeWidth = 0.5f
                canvas.drawLine(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight, paint)

                currentY += rowHeight
            }

            // Final footer
            paint.color = Color.parseColor("#94A3B8")
            paint.textSize = 8f
            paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            val pageStr = "Page $pageNumber"
            canvas.drawText(pageStr, pageWidth - margin - paint.measureText(pageStr), pageHeight - 15f, paint)

            pdfDocument.finishPage(page)

            val exportDir = File(reactContext.cacheDir, "exports")
            if (!exportDir.exists()) {
                exportDir.mkdirs()
            }
            val finalPdfFile = File(exportDir, fileName)
            FileOutputStream(finalPdfFile).use { out ->
                pdfDocument.writeTo(out)
            }
            pdfDocument.close()

            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                finalPdfFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, dialogTitle).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PDF_ERROR", e.message, e)
        }
    }
}


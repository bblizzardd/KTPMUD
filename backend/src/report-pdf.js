import { localDate } from './common.js';

const missing = 'Chưa ghi nhận';
const dash = '—';
const slotLabels = { MORNING: 'sáng', NOON: 'trưa', AFTERNOON: 'chiều', EVENING: 'tối' };
const statusLabels = {
  SCHEDULED: 'Đã lên lịch', PENDING: 'Đang chờ', TAKEN: 'Đã uống',
  TAKEN_BY_DELEGATE: 'Xác nhận hộ', LATE_CONFIRMED: 'Xác nhận muộn', MISSED: 'Bỏ lỡ', CANCELLED: 'Đã hủy',
};
const labTypes = [
  ['HBA1C', 'HbA1c', '%', '< 7,0 %'],
  ['FASTING_GLUCOSE', 'Đường huyết lúc đói (FBG)', 'mmol/L', '4,4 – 7,2 mmol/L'],
  ['POSTPRANDIAL_GLUCOSE', 'Đường huyết sau ăn (PPG)', 'mmol/L', '< 10,0 mmol/L'],
  ['OTHER', 'Chỉ số khác', dash, dash],
];
const timeFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const date = (iso) => iso ? iso.split('-').reverse().join('/') : dash;
const time = (iso) => timeFormat.format(new Date(iso));
const timestamp = (iso) => iso ? `${time(iso)}  ${date(localDate(iso))}` : dash;
const doseName = (name, quantity, unit) => quantity == null ? name : `${name} · ${quantity} ${unit || 'viên'}/cữ`;

const titleStyle = { size: 13, fill: '#1F4E78', color: '#FFFFFF', align: 'center', pad: 5 };
const sectionStyle = { size: 9.5, fill: '#2F5496', color: '#FFFFFF', pad: 3 };
const headerStyle = { fill: '#D9E1F2', color: '#17365D' };

// Measure each row using the same font and widths used to print it. Repeat the section
// title and column labels when a long medication list or journal crosses a page.
function reportLayout(doc) {
  const { left, right, top, bottom } = doc.page.margins;
  const width = doc.page.width - left - right;
  const limit = doc.page.height - bottom;
  let y = top;

  function row(values, widths, style = {}, draw = true) {
    const { size = 8.5, pad = 2, fill = '#FFFFFF', color = '#172536', align = 'left' } = style;
    const cells = values.map((value) => String(value ?? dash).replace(/\s+/gu, ' ').trim());
    doc.fontSize(size);
    const options = widths.map((fraction) => ({ width: width * fraction - 10, align }));
    const height = Math.max(...cells.map((cell, i) => doc.heightOfString(cell || ' ', options[i]))) + 2 * pad;
    if (draw) {
      let x = left;
      for (const [i, cell] of cells.entries()) {
        const w = width * widths[i];
        doc.rect(x, y, w, height).lineWidth(0.4).fillAndStroke(fill, '#B4C4D6');
        doc.fillColor(color).text(cell, x + 5, y + pad, options[i]);
        x += w;
      }
      y += height;
    }
    return height;
  }

  function newPage() {
    doc.addPage();
    y = top;
  }

  function section(title, widths, rows, { headers, note, style = sectionStyle, rowStyle = {}, noteStyle = { size: 8, fill: '#FFF2CC' }, keepTogether = false, signature = false } = {}) {
    function heading(draw) {
      let height = row([title], [1], style, draw);
      if (note) height += row([note], [1], noteStyle, draw);
      if (headers) height += row(headers, widths, headerStyle, draw);
      return height;
    }
    const bodyHeight = keepTogether ? rows.reduce((h, cells) => h + row(cells, widths, rowStyle, false), 0) : row(rows[0], widths, rowStyle, false);
    if (y + heading(false) + bodyHeight + (signature ? 42 : 0) > limit) newPage();
    heading(true);
    for (const cells of rows) {
      if (y + row(cells, widths, rowStyle, false) > limit) {
        newPage();
        heading(true);
      }
      row(cells, widths, rowStyle);
    }
    if (signature) {
      doc.fontSize(9).fillColor('#17365D').text('Chữ ký & Họ tên Bác sĩ điều trị', left + width / 2, y + 4, { width: width / 2, align: 'center' });
      doc.text('........................................................', left + width / 2, y + 28, { width: width / 2, align: 'center' });
      y += 42;
    }
    y += 4;
  }

  function numberPages(alias) {
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor('#526475').text(`An Tâm  |  ${alias}  |  ${i + 1}/${count}`, left, limit + 7, { width, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
  }
  return { row, newPage, section, numberPages };
}

export function drawClinicalReport(doc, data) {
  const { patient, prescription, appointments, labs, doses, summary, includeLate, fromDate, toDate, periodDays, exportDate } = data;
  const page = reportLayout(doc);
  page.row([`BÁO CÁO TUÂN THỦ & THEO DÕI ĐIỀU TRỊ NGOẠI TRÚ (${periodDays} NGÀY)`], [1], titleStyle);
  page.row([`Dành cho Bác sĩ tái khám  |  Dữ liệu từ ${date(fromDate)} đến ${date(toDate)}  |  Ngày xuất: ${date(exportDate)}`], [1], { align: 'center' });

  const items = prescription?.items || [];
  const drug = (item) => [doseName(item.drugNameRaw, item.unitsPerDose, item.unit),
    (item.slots || []).map((slot) => slotLabels[slot] || slot).join(', '), item.instruction].filter(Boolean).join(' · ');
  const nextVisit = [appointments[0]?.visitDate, prescription?.nextVisitDate].filter((d) => d && d >= exportDate).sort()[0];
  const info = [
    ['Tên gọi gia đình / Mã BN', `${patient.alias} (${patient.id})`, 'Ngày kê đơn', date(prescription?.issuedDate)],
    ['Năm sinh / Tuổi', patient.birthYear ? `${patient.birthYear} (khoảng ${Number(toDate.slice(0, 4)) - patient.birthYear} tuổi)` : missing, 'Ngày bắt đầu uống', date(prescription?.startDate)],
    ['Chẩn đoán điều trị', missing, 'Lịch tái khám kế tiếp', date(nextVisit)],
    ['Nơi theo dõi / Khám', missing, 'Thuốc điều trị chính', items.length ? drug(items[0]) : 'Chưa có đơn đang hiệu lực'],
  ];
  for (const item of items.slice(1)) info.push(['', '', 'Thuốc trong đơn', drug(item)]);
  for (const visit of appointments) info.push(['Lịch hẹn', date(visit.visitDate), `Nhắc trước ${visit.remindDaysBefore} ngày`, visit.note || dash]);
  page.section('I. THÔNG TIN BỆNH NHÂN & ĐƠN THUỐC DÙNG TẠI NHÀ', [.21, .32, .20, .27], info);

  const rate = summary.adherenceRate;
  const grade = rate >= .8 ? 'Tốt' : rate >= .5 ? 'Trung bình' : 'Kém';
  const result = summary.totalDoses ? `${(rate * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% · ${grade}` : 'Chưa đủ dữ liệu';
  const prescriptionDays = prescription?.startDate && prescription?.nextVisitDate
    ? Math.max(0, Math.round((Date.parse(`${prescription.nextVisitDate}T00:00:00Z`) - Date.parse(`${prescription.startDate}T00:00:00Z`)) / 86_400_000) + 1)
    : 0;
  const dosesPerDay = items.reduce((total, item) => total + (item.slots?.length || 0), 0);
  page.section('II. TỔNG HỢP KẾT QUẢ TUÂN THỦ DÙNG THUỐC', [.32, .14, .32, .22], [
    ['Tổng số ngày uống thuốc theo đơn', prescriptionDays ? `${prescriptionDays} ngày` : dash, 'Số cữ thuốc trong một ngày', dosesPerDay ? `${dosesPerDay} cữ/ngày` : dash],
    ['Tổng số cữ có kết quả', summary.totalDoses, 'Số cữ đã uống đúng giờ', summary.taken],
    ['Số cữ xác nhận muộn', summary.lateConfirmed, 'Số cữ xác nhận hộ (người nhà)', summary.takenByDelegate],
    ['Số cữ bỏ lỡ', summary.missed, 'Tỷ lệ tuân thủ tổng thể', result],
  ], {
    style: { ...sectionStyle, size: 12, pad: 4 },
    rowStyle: { size: 11, pad: 3.5, fill: '#F4F8FD', color: '#0F253E' },
    noteStyle: { size: 8.5, fill: '#FFF2CC', pad: 2.5 },
    note: `Tỷ lệ = (đã uống đúng giờ + xác nhận hộ${includeLate ? ' + xác nhận muộn' : ''}) / số cữ có kết quả. Loại trừ cữ đã hủy, đang chờ và chưa đến giờ.`,
  });

  const clinicalRows = [];
  const history = [];
  for (const [type, label, unit, target] of labTypes) {
    const results = labs.filter((lab) => lab.testType === type);
    const [latest, ...earlier] = results;
    if (type === 'OTHER' && !latest) continue;
    clinicalRows.push([label, latest?.value ?? 'Chưa có KQ', latest?.unit || unit, date(latest?.testedDate), target, latest?.note || dash]);
    for (const lab of earlier) history.push([label, lab.value, lab.unit, date(lab.testedDate), lab.note || dash]);
  }
  clinicalRows.push(['Triệu chứng hạ đường huyết', missing, dash, dash, dash, dash]);
  page.section('III. THEO DÕI CHỈ SỐ LÂM SÀNG & ĐƯỜNG HUYẾT', [.23, .15, .10, .14, .18, .20], clinicalRows,
    { headers: ['Chỉ số theo dõi', 'Giá trị gần nhất', 'Đơn vị', 'Ngày ghi nhận', 'Mục tiêu theo mẫu', 'Đánh giá sơ bộ / Ghi chú'] });
  if (history.length) page.section('Lịch sử chỉ số trong kỳ', [.25, .15, .12, .16, .32], history,
    { headers: ['Chỉ số theo dõi', 'Giá trị', 'Đơn vị', 'Ngày ghi nhận', 'Ghi chú'] });

  const exceptions = doses.filter((dose) => ['MISSED', 'LATE_CONFIRMED'].includes(dose.status));
  const exceptionRows = exceptions.map((dose, i) => {
    const delay = Math.round((Date.parse(dose.takenAt) - Date.parse(dose.scheduledAt)) / 60_000);
    const note = dose.status === 'MISSED' ? 'Hết hạn xác nhận' : Number.isFinite(delay) ? `Muộn ${delay} phút` : dash;
    return [i + 1, timestamp(dose.scheduledAt), doseName(dose.drugDisplayName, dose.unitsPerDose, dose.unit),
      statusLabels[dose.status], timestamp(dose.takenAt), note];
  });
  const exceptionTitle = `IV. CHI TIẾT CÁC CỮ BỎ LỠ VÀ XÁC NHẬN MUỘN TRONG KỲ (${exceptions.length} CỮ)`;
  if (exceptions.length) page.section(exceptionTitle, [.06, .18, .25, .15, .19, .17], exceptionRows,
    { headers: ['STT', 'Thời điểm dự kiến', 'Tên thuốc & Liều', 'Trạng thái', 'Giờ uống khai báo', 'Mức độ lệch / Ghi chú'] });
  else page.section(exceptionTitle, [1], [['Không có cữ bỏ lỡ hoặc xác nhận muộn trong kỳ.']]);

  page.section('V. ĐÁNH GIÁ & CHỈ ĐỊNH CỦA BÁC SĨ ĐIỀU TRỊ TẠI BUỔI TÁI KHÁM', [.29, .71], [
    ['Đánh giá mức độ tuân thủ', '[   ] Tốt (≥80%)       [   ] Trung bình (50% đến dưới 80%)       [   ] Kém (<50%)'],
    ['Nguyên nhân bỏ cữ chính', ''],
    ['Chỉ định xét nghiệm bổ sung', ''],
    ['Hướng điều chỉnh đơn thuốc', '[   ] Giữ nguyên đơn cũ       [   ] Tăng liều       [   ] Thay đổi loại thuốc       [   ] Khác: .....................'],
    ['Lời khuyên cho người chăm sóc', ''],
  ], { keepTogether: true, signature: true });

  page.newPage();
  const journalTitle = `BẢNG NHẬT KÝ CHI TIẾT TOÀN BỘ CỮ THUỐC TRONG KỲ (${periodDays} NGÀY)`;
  const journalRows = doses.map((dose, i) => [i + 1, date(dose.date || localDate(dose.scheduledAt)), time(dose.scheduledAt),
    dose.drugDisplayName, statusLabels[dose.status] || dose.status, timestamp(dose.confirmation?.recordedAt), dose.confirmation?.actorLabel || dash]);
  page.section(journalTitle, [.05, .12, .12, .24, .14, .20, .13],
    journalRows.length ? journalRows : [[dash, dash, dash, 'Chưa có cữ thuốc trong kỳ', dash, dash, dash]],
    { style: titleStyle, headers: ['STT', 'Ngày', 'Mốc giờ quy định', 'Tên thuốc', 'Trạng thái ghi nhận', 'Thời điểm xác nhận thực tế', 'Người xác nhận'] });
  page.numberPages(patient.alias);
}

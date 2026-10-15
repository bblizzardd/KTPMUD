import {DatabaseSync} from 'node:sqlite';
import {randomUUID, createHash, randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const id = () => randomUUID();
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateAdd = (date, days) => new Date(Date.parse(date+'T12:00:00+07:00')+days*86400000).toISOString().slice(0,10);
export const stamp = (date,time) => new Date(`${date}T${time}:00+07:00`).toISOString();
export const hash = value => createHash('sha256').update(value).digest('hex');
export const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
export const secret = () => randomBytes(32).toString('hex');
export function fail(message, status=400) {const e=new Error(message);e.status=status;throw e;}
export function requireValue(condition,message,status=400) {if(!condition) fail(message,status);}
export function openStore(filename) {
  if(filename!==':memory:') mkdirSync(dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const tables=['users','patients','prescriptions','doses','confirmations','audit','devices','codes','sessions','labs','appointments','alerts'];
  for(const table of tables) db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(json_extract(data, '$.email'))");
  for(const table of ['confirmations','audit']) for(const action of ['UPDATE','DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_${action} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'Append-only record'); END`);
  const check = t => {if(!tables.includes(t)) throw new Error('Unknown table');};
  return {
    db,
    all(t){check(t);return db.prepare(`SELECT data FROM ${t}`).all().map(r=>JSON.parse(r.data));},
    get(t,i){check(t);const row=db.prepare(`SELECT data FROM ${t} WHERE id=?`).get(i);return row?JSON.parse(row.data):null;},
    add(t,r){check(t);const v={id:id(),...r};db.prepare(`INSERT INTO ${t} VALUES (?,?)`).run(v.id,JSON.stringify(v));return v;},
    put(t,r){check(t);db.prepare(`UPDATE ${t} SET data=? WHERE id=?`).run(JSON.stringify(r),r.id);return r;},
    remove(t,i){check(t);db.prepare(`DELETE FROM ${t} WHERE id=?`).run(i);},
    tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
  };
}
export const catalog=[
  {id:'met500',name:'Metformin 500 mg',ingredient:'Metformin',strength:'500 mg'},
  {id:'glu500',name:'Glucophage 500 mg',ingredient:'Metformin',strength:'500 mg'},
  {id:'pan500',name:'Panfor SR 500 mg',ingredient:'Metformin',strength:'500 mg'},
  {id:'gli30',name:'Gliclazide MR 30 mg',ingredient:'Gliclazide',strength:'30 mg'},
  {id:'sit100',name:'Sitagliptin 100 mg',ingredient:'Sitagliptin',strength:'100 mg'}
];
export function audit(s,actor,patientId,action,detail='') {return s.add('audit',{timestamp:new Date().toISOString(),userId:actor.id,userName:actor.name,role:actor.role||'caregiver',patientId,action,status:'success',detail});}
export function validatePatient(b) {
  requireValue(typeof b.name==='string'&&b.name.trim().length>0&&b.name.length<=50,'Nhập tên gọi trong gia đình (tối đa 50 ký tự).');
  requireValue(Number.isInteger(+b.birthYear)&&+b.birthYear>=1900&&+b.birthYear<=new Date().getFullYear(),'Năm sinh không hợp lệ.');
  requireValue(Number.isInteger(+b.threshold)&&+b.threshold>=5&&+b.threshold<=1440,'Ngưỡng bỏ lỡ phải từ 5 đến 1440 phút.');
  const times=b.times||{morning:'07:00',noon:'12:00',evening:'19:00'};
  requireValue(['morning','noon','evening'].every(k=>/^([01]\d|2[0-3]):[0-5]\d$/.test(times[k])),'Giờ nhắc không hợp lệ.');
  return {name:b.name.trim(),birthYear:+b.birthYear,threshold:+b.threshold,times};
}
export function validatePrescription(b) {
  for(const key of ['issued','start','end']) requireValue(validDate(b[key]),'Ngày không hợp lệ.');
  requireValue(b.issued<=b.start&&b.start<=b.end,'Ngày kê ≤ ngày bắt đầu ≤ ngày tái khám.');
  requireValue((Date.parse(b.end)-Date.parse(b.start))/86400000<=365,'Một đơn tối đa 365 ngày.');
  requireValue(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=20,'Đơn cần từ 1 đến 20 thuốc.');
  const items=b.items.map(x=>{
    requireValue(typeof x.name==='string'&&x.name.trim()&&x.name.length<=120,'Nhập tên gốc trên đơn.');
    requireValue(Number.isFinite(+x.quantity)&&+x.quantity>0&&+x.quantity<=100,'Số đơn vị mỗi lần phải lớn hơn 0, tối đa 100.');
    requireValue(Array.isArray(x.slots)&&x.slots.length>0&&x.slots.every(k=>['morning','noon','evening'].includes(k)),'Chọn ít nhất một buổi uống.');
    const drug=catalog.find(d=>d.id===x.drugId);
    return {name:x.name.trim(),drugId:drug?.id||null,ingredient:drug?.ingredient||null,quantity:+x.quantity,unit:String(x.unit||'viên').slice(0,30),slots:[...new Set(x.slots)],note:String(x.note||'').slice(0,300)};
  });
  return {issued:b.issued,start:b.start,end:b.end,items};
}
export function warnings(rx){const seen=new Set();return rx.items.filter(x=>x.ingredient).flatMap(x=>{if(seen.has(x.ingredient))return [`Có nhiều thuốc cùng hoạt chất ${x.ingredient}. Hãy đối chiếu đơn và hỏi lại bác sĩ; ứng dụng không tự thay đổi đơn.`];seen.add(x.ingredient);return [];});}
export function activate(s,rxId,actor,now=new Date()) {
  return s.tx(()=>{
    const rx=s.get('prescriptions',rxId);requireValue(rx?.status==='draft','Đơn không còn ở trạng thái Nháp.',409);
    requireValue(rx.end>=today(),'Đơn đã qua ngày tái khám.',422);
    const p=s.get('patients',rx.patientId);
    for(const old of s.all('prescriptions').filter(x=>x.patientId===p.id&&x.status==='active')) {
      s.put('prescriptions',{...old,status:'replaced'});
      for(const d of s.all('doses').filter(x=>x.prescriptionId===old.id&&Date.parse(x.scheduledAt)>now.getTime())) s.put('doses',{...d,status:'cancelled'});
    }
    s.put('prescriptions',{...rx,status:'active',confirmedAt:now.toISOString()});
    for(let date=rx.start;date<=rx.end;date=dateAdd(date,1)) for(const slot of ['morning','noon','evening']) {
      const items=rx.items.filter(x=>x.slots.includes(slot));if(!items.length)continue;
      const scheduledAt=stamp(date,p.times[slot]);
      // Activating a new prescription never fabricates overdue past doses.
      if(Date.parse(scheduledAt)<now.getTime()) continue;
      s.add('doses',{patientId:p.id,prescriptionId:rx.id,date,slot,scheduledAt,deadline:new Date(Date.parse(scheduledAt)+p.threshold*60000).toISOString(),items,status:'scheduled'});
    }
    s.add('appointments',{patientId:p.id,date:rx.end,remindDays:3,note:'Tái khám theo đơn thuốc',prescriptionId:rx.id});
    audit(s,actor,p.id,'CONFIRM_PRESCRIPTION','Duyệt đơn, thay đơn cũ và sinh lịch cữ');return rx;
  });
}
export function confirmDose(s,doseId,actor,body={},now=new Date()) {
  return s.tx(()=>{
    const d=s.get('doses',doseId);requireValue(d,'Không tìm thấy cữ thuốc.',404);
    requireValue(actor.patientId===d.patientId&&['patient','delegate'].includes(actor.role),'Chỉ thiết bị bệnh nhân hoặc người nhà được ủy quyền mới xác nhận.',403);
    requireValue(d.status!=='cancelled','Cữ đã hủy vì đơn được thay thế.',422);
    const existing=s.all('confirmations').filter(x=>x.doseId===d.id).at(-1);
    if(existing&&!body.corrects) return {duplicate:true,confirmation:existing};
    if(body.corrects) {requireValue(existing?.id===body.corrects,'Chỉ đính chính bản ghi gần nhất.',409);requireValue(typeof body.reason==='string'&&body.reason.trim().length>=3,'Cần lý do đính chính.');}
    const tookAt=body.tookAt?new Date(body.tookAt):now;
    requireValue(Number.isFinite(tookAt.getTime())&&tookAt<=now&&tookAt>=new Date(d.scheduledAt),'Thời điểm xác nhận phải từ giờ cữ thuốc đến hiện tại.');
    const status=tookAt>new Date(d.deadline)?'late':actor.role==='delegate'?'proxy':'taken';
    const c=s.add('confirmations',{doseId:d.id,patientId:d.patientId,actorId:actor.id,actorName:actor.name,role:actor.role,tookAt:tookAt.toISOString(),recordedAt:now.toISOString(),corrects:body.corrects||null,reason:body.reason||'',status});
    s.put('doses',{...d,status,confirmationId:c.id});
    for(const key of ['missed-'+d.id,'due-'+d.id]) {const alert=s.get('alerts',key);if(alert)s.put('alerts',{...alert,resolved:true});}
    audit(s,actor,d.patientId,body.corrects?'CORRECT_CONFIRMATION':'CONFIRM_DOSE',d.id);return {confirmation:c};
  });
}
export function tick(s,now=new Date()) {
  const system={id:'scheduler',name:'Bộ lập lịch',role:'system'};
  const makeAlert=(key,d,type,message)=>{if(!s.get('alerts',key)){s.add('alerts',{id:key,patientId:d.patientId,type,message,createdAt:now.toISOString(),read:false});audit(s,system,d.patientId,'CREATE_ALERT',message);}};
  s.tx(()=>{
    for(const d of s.all('doses')) {
      if(!['scheduled','pending'].includes(d.status))continue;
      if(now>new Date(d.deadline)) {s.put('doses',{...d,status:'missed'});makeAlert('missed-'+d.id,d,'missed',`Chưa có xác nhận cữ ${d.slot==='morning'?'sáng':d.slot==='noon'?'trưa':'tối'} ngày ${d.date}.`);}
      else if(now>=new Date(d.scheduledAt)) {s.put('doses',{...d,status:'pending'});makeAlert('due-'+d.id,d,'due','Đến giờ uống thuốc theo đơn đã xác nhận.');}
    }
    for(const a of s.all('appointments')) if((!a.prescriptionId||s.get('prescriptions',a.prescriptionId)?.status==='active')&&today()>=dateAdd(a.date,-a.remindDays)&&today()<=a.date) makeAlert('appointment-'+a.id,a,'appointment',`Lịch tái khám ngày ${a.date}: ${a.note||'Chuẩn bị báo cáo ghi nhận.'}`);
  });
}
export function summary(doses,days=7,now=new Date()) {
  const start=dateAdd(today(),1-days);
  const eligible=doses.filter(d=>d.date>=start&&d.date<=today()&&d.status!=='cancelled'&&new Date(d.scheduledAt)<=now);
  const counts={taken:0,proxy:0,late:0,missed:0,pending:0};for(const d of eligible)if(d.status in counts)counts[d.status]++;
  return {...counts,total:eligible.length,rate:eligible.length?Math.round((counts.taken+counts.proxy)/eligible.length*100):null,recorded:counts.taken+counts.proxy+counts.late};
}

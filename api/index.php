<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$config = require __DIR__ . '/config.php';

function respond(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $message, int $status = 400): never { respond(['error' => $message, 'message' => $message], $status); }
function body(): array {
    $decoded = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}
function uuid(): string {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}
function publicUser(array $user): array {
    unset($user['password_hash'], $user['otp_code'], $user['otp_expires_at'], $user['reset_token_hash'], $user['reset_expires_at']);
    return $user;
}
function bearerToken(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    return preg_match('/^Bearer\s+(.+)$/i', $header, $m) ? trim($m[1]) : null;
}
function issueToken(PDO $db, string $userId): string {
    $token = bin2hex(random_bytes(32));
    $stmt = $db->prepare('INSERT INTO auth_tokens (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 30 DAY))');
    $stmt->execute([hash('sha256', $token), $userId]);
    return $token;
}
function currentUser(PDO $db, bool $required = true): ?array {
    $token = bearerToken();
    if (!$token) {
        if ($required) fail('Authentication required', 401);
        return null;
    }
    $stmt = $db->prepare("SELECT u.* FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>NOW() AND u.verified_at IS NOT NULL AND COALESCE(u.status,'active')<>'blocked'");
    $stmt->execute([hash('sha256', $token)]);
    $user = $stmt->fetch();
    if (!$user && $required) fail('Session expired', 401);
    return $user ?: null;
}
function requireAdmin(array $user): void {
    if (($user['role'] ?? '') !== 'admin') fail('Administrator access required', 403);
}
function quoted(string $name): string { return '`' . str_replace('`', '``', $name) . '`'; }
function ensureUserStatusColumn(PDO $db): void {
    $stmt = $db->query("SHOW COLUMNS FROM users LIKE 'status'");
    if (!$stmt->fetch()) {
        $db->exec("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER role");
    }
}
function ensureCanChangeAdmin(PDO $db, string $targetId, ?string $newRole = null, ?string $newStatus = null, bool $deleting = false): void {
    $stmt = $db->prepare('SELECT role,status FROM users WHERE id=?');
    $stmt->execute([$targetId]);
    $target = $stmt->fetch();
    if (!$target) fail('User not found', 404);
    $isActiveAdmin = ($target['role'] ?? '') === 'admin' && ($target['status'] ?? 'active') !== 'blocked';
    $willStopBeingActiveAdmin = $deleting
        || ($newRole !== null && $newRole !== 'admin')
        || ($newStatus !== null && $newStatus === 'blocked');
    if ($isActiveAdmin && $willStopBeingActiveAdmin) {
        $count = (int)$db->query("SELECT COUNT(*) FROM users WHERE role='admin' AND COALESCE(status,'active')<>'blocked'")->fetchColumn();
        if ($count <= 1) fail('You cannot remove or block the last active admin', 422);
    }
}

$entities = [
    'Property' => ['table'=>'properties','fields'=>['name','address','type','unit_count','description'],'numeric'=>['unit_count']],
    'Unit' => ['table'=>'units','fields'=>['property_id','unit_number','type','rent_amount','status'],'numeric'=>['rent_amount']],
    'Tenant' => ['table'=>'tenants','fields'=>['full_name','phone','email','unit_id','property_id','lease_start','lease_end','monthly_rent','balance','status','nida_number','passport_number','tin_number','employer','employer_phone','next_of_kin_name','next_of_kin_phone','next_of_kin_relation'],'numeric'=>['monthly_rent','balance']],
    'Payment' => ['table'=>'payments','fields'=>['tenant_id','unit_id','amount','payment_date','method','period','reference','status'],'numeric'=>['amount']],
    'Expense' => ['table'=>'expenses','fields'=>['description','amount','date','category','property_id','vendor','payment_method'],'numeric'=>['amount']],
    'MaintenanceRequest' => ['table'=>'maintenance_requests','fields'=>['unit_id','property_id','tenant_id','title','description','priority','status','assigned_technician','cost','reported_date','resolved_date'],'numeric'=>['cost']],
    'Staff' => ['table'=>'staff','fields'=>['full_name','phone','email','role','system_role','property_id','salary','status','start_date'],'numeric'=>['salary']],
    'Utility' => ['table'=>'utilities','fields'=>['property_id','unit_id','utility_type','previous_reading','current_reading','consumption','rate','amount','reading_date','period','status'],'numeric'=>['previous_reading','current_reading','consumption','rate','amount']],
    'Inventory' => ['table'=>'inventory','fields'=>['property_id','unit_id','item_name','category','quantity','condition','value','notes'],'numeric'=>['quantity','value']],
    'Penalty' => ['table'=>'penalties','fields'=>['tenant_id','amount','base_rent','period','date_applied','status'],'numeric'=>['amount','base_rent']],
    'Lead' => ['table'=>'leads','fields'=>['full_name','phone','email','interested_property_id','preferred_unit_type','budget','source','status','notes','follow_up_date'],'numeric'=>['budget']],
    'RentReminder' => ['table'=>'rent_reminders','fields'=>['tenant_id','property_id','amount_due','period','reminder_date','message','status','channel'],'numeric'=>['amount_due']],
    'Setting' => ['table'=>'settings','fields'=>['company_name','contact_person','phone','email','address','tin_number','logo_url','penalty_rate','grace_period_days','late_fee_policy','fixed_late_fee','currency','fiscal_year_start','bank_name','bank_account_name','bank_account_number','mpesa_paybill','airtel_money_number','tigopesa_number'],'numeric'=>['penalty_rate','grace_period_days','fixed_late_fee']],
    'User' => ['table'=>'users','fields'=>['email','full_name','role','status'],'numeric'=>[]],
];
$writeRoles = [
    'Property'=>['admin','manager','msimamizi'], 'Unit'=>['admin','manager','msimamizi'],
    'Tenant'=>['admin','manager','accountant','msimamizi'], 'Payment'=>['admin','manager','accountant'],
    'Expense'=>['admin','manager','accountant'], 'Penalty'=>['admin','manager','accountant'],
    'Setting'=>['admin'], 'User'=>['admin'],
    'MaintenanceRequest'=>['admin','manager','msimamizi','user'],
    'Utility'=>['admin','manager','msimamizi','user'], 'Inventory'=>['admin','manager','msimamizi','user'],
    'Lead'=>['admin','manager','msimamizi','user'], 'Staff'=>['admin','manager','msimamizi'],
    'RentReminder'=>['admin','manager'],
];
function castRows(array $rows, array $numeric): array {
    foreach ($rows as &$row) {
        foreach ($numeric as $field) if (array_key_exists($field, $row) && $row[$field] !== null) $row[$field] = (float)$row[$field];
    }
    return $rows;
}
function cleanData(array $input, array $fields): array {
    return array_intersect_key($input, array_flip($fields));
}
function validateEntityData(string $entity, array $data): array {
    if ($entity === 'Property' && array_key_exists('unit_count', $data)) {
        if (!is_numeric($data['unit_count'])) fail('Number of units must be a number');
        $unitCount = (float)$data['unit_count'];
        if ($unitCount < 0 || floor($unitCount) !== $unitCount) fail('Number of units must be a whole number of 0 or more');
        $data['unit_count'] = (int)$unitCount;
    }
    return $data;
}
function whereClause(array $filter, array $fields, array &$params): string {
    $parts = [];
    foreach ($filter as $key => $value) {
        if (!in_array($key, array_merge($fields, ['id','created_by','created_date','updated_date']), true)) continue;
        if ($value === null) $parts[] = quoted($key) . ' IS NULL';
        else { $parts[] = quoted($key) . ' = ?'; $params[] = $value; }
    }
    return $parts ? ' WHERE ' . implode(' AND ', $parts) : '';
}
function canWrite(string $entity, array $user, array $writeRoles): void {
    if (!in_array($user['role'], $writeRoles[$entity] ?? ['admin'], true)) fail('You do not have permission to change this data', 403);
}

try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']);
    $db = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    ensureUserStatusColumn($db);

    $route = trim((string)($_GET['route'] ?? ''), '/');
    $method = $_SERVER['REQUEST_METHOD'];

    if ($route === '') respond(['ok'=>true, 'service'=>'Rent Smart TZ API', 'database'=>$config['db_name'], 'frontend'=>$config['app_url']]);
    if ($route === 'health') respond(['ok'=>true, 'database'=>$config['db_name']]);

    if ($route === 'auth/register' && $method === 'POST') {
        $data = body(); $email = strtolower(trim((string)($data['email'] ?? ''))); $password = (string)($data['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address');
        if (strlen($password) < 8) fail('Password must be at least 8 characters');
        $check = $db->prepare('SELECT id,verified_at FROM users WHERE email=?'); $check->execute([$email]); $existing = $check->fetch();
        if ($existing && $existing['verified_at']) fail('An account with this email already exists', 409);
        $userCount=(int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if (!$existing && $userCount > 0) fail('Registration is closed. Ask an administrator to invite you.', 403);
        $otp = '224422';
        if ($existing) {
            $stmt=$db->prepare('UPDATE users SET password_hash=?,otp_code=?,otp_expires_at=DATE_ADD(NOW(),INTERVAL 15 MINUTE) WHERE id=?');
            $stmt->execute([password_hash($password,PASSWORD_DEFAULT),$otp,$existing['id']]);
        } else {
            $stmt=$db->prepare('INSERT INTO users (id,email,password_hash,role,otp_code,otp_expires_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))');
            $stmt->execute([uuid(),$email,password_hash($password,PASSWORD_DEFAULT),'admin',$otp]);
        }
        @mail($email, 'Rent Smart verification code', "Your verification code is: $otp");
        $response=['message'=>'Verification code sent'];
        respond($response, 201);
    }
    if ($route === 'auth/verify-otp' && $method === 'POST') {
        $data=body(); $email=strtolower(trim((string)($data['email']??''))); $otp=(string)($data['otpCode']??'');
        $stmt=$db->prepare('SELECT * FROM users WHERE email=? AND otp_code=? AND otp_expires_at>NOW()'); $stmt->execute([$email,$otp]); $user=$stmt->fetch();
        if (!$user) fail('Invalid or expired verification code', 422);
        $db->prepare('UPDATE users SET verified_at=NOW(),otp_code=NULL,otp_expires_at=NULL WHERE id=?')->execute([$user['id']]);
        respond(['access_token'=>issueToken($db,$user['id']),'user'=>publicUser($user)]);
    }
    if ($route === 'auth/resend-otp' && $method === 'POST') {
        $data=body(); $email=strtolower(trim((string)($data['email']??''))); $otp='224422';
        $stmt=$db->prepare('UPDATE users SET otp_code=?,otp_expires_at=DATE_ADD(NOW(),INTERVAL 15 MINUTE) WHERE email=? AND verified_at IS NULL');
        $stmt->execute([$otp,$email]); if (!$stmt->rowCount()) fail('Pending registration not found',404);
        @mail($email,'Rent Smart verification code',"Your verification code is: $otp");
        $response=['message'=>'Verification code sent']; respond($response);
    }
    if ($route === 'auth/login' && $method === 'POST') {
        $data=body(); $email=strtolower(trim((string)($data['email']??'')));
        $stmt=$db->prepare('SELECT * FROM users WHERE email=?'); $stmt->execute([$email]); $user=$stmt->fetch();
        if (!$user || !$user['verified_at'] || ($user['status'] ?? 'active') === 'blocked' || !password_verify((string)($data['password']??''),$user['password_hash'])) fail('Invalid email or password',401);
        respond(['access_token'=>issueToken($db,$user['id']),'user'=>publicUser($user)]);
    }
    if ($route === 'auth/reset-request' && $method === 'POST') {
        $data=body(); $email=strtolower(trim((string)($data['email']??''))); $token=bin2hex(random_bytes(24));
        $stmt=$db->prepare('UPDATE users SET reset_token_hash=?,reset_expires_at=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE email=?');
        $stmt->execute([hash('sha256',$token),$email]);
        $url=rtrim($config['app_url'],'/').'/reset-password?token='.urlencode($token);
        if($stmt->rowCount()) @mail($email,'Rent Smart password reset',"Reset your password: $url");
        $response=['message'=>'If the account exists, a reset link has been sent'];
        if($config['app_env']==='development' && $stmt->rowCount())$response['reset_url']=$url;
        respond($response);
    }
    if ($route === 'auth/reset' && $method === 'POST') {
        $data=body(); $token=(string)($data['resetToken']??''); $password=(string)($data['newPassword']??'');
        if(strlen($password)<8)fail('Password must be at least 8 characters');
        $stmt=$db->prepare('SELECT id FROM users WHERE reset_token_hash=? AND reset_expires_at>NOW()'); $stmt->execute([hash('sha256',$token)]); $id=$stmt->fetchColumn();
        if(!$id)fail('Invalid or expired reset link',422);
        $db->prepare('UPDATE users SET password_hash=?,reset_token_hash=NULL,reset_expires_at=NULL WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$id]);
        respond(['message'=>'Password reset']);
    }

    $user=currentUser($db);

    if ($route === 'auth/me' && $method === 'GET') respond(publicUser($user));
    if ($route === 'auth/logout' && $method === 'POST') {
        $token=bearerToken(); if($token)$db->prepare('DELETE FROM auth_tokens WHERE token_hash=?')->execute([hash('sha256',$token)]);
        respond(['ok'=>true]);
    }
    if ($route === 'users/invite' && $method === 'POST') {
        requireAdmin($user); $data=body(); $email=strtolower(trim((string)($data['email']??'')));
        if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid email address');
        $role=(string)($data['role']??'user'); if(!in_array($role,['admin','manager','accountant','msimamizi','user'],true))$role='user';
        $temporary=bin2hex(random_bytes(6));
        try {
            $stmt=$db->prepare('INSERT INTO users (id,email,password_hash,role,verified_at) VALUES (?,?,?,?,NOW())');
            $stmt->execute([uuid(),$email,password_hash($temporary,PASSWORD_DEFAULT),$role]);
        } catch(PDOException $e) { if($e->getCode()==='23000')fail('A user with this email already exists',409); throw $e; }
        @mail($email,'Rent Smart invitation',"You have been invited. Temporary password: $temporary");
        $response=['message'=>'User invited']; if($config['app_env']==='development')$response['temporary_password']=$temporary; respond($response,201);
    }
    if ($route === 'users/update' && $method === 'POST') {
        requireAdmin($user);
        $data = body();
        $id = (string)($data['id'] ?? '');
        if (!$id) fail('User id is required');
        $updates = [];
        if (array_key_exists('email', $data)) {
            $email = strtolower(trim((string)$data['email']));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address');
            $updates['email'] = $email;
        }
        if (array_key_exists('full_name', $data)) $updates['full_name'] = trim((string)$data['full_name']) ?: null;
        if (array_key_exists('role', $data)) {
            $role = (string)$data['role'];
            if (!in_array($role, ['admin','manager','accountant','msimamizi','user'], true)) fail('Invalid role');
            $updates['role'] = $role;
        }
        if (array_key_exists('status', $data)) {
            $status = (string)$data['status'];
            if (!in_array($status, ['active','blocked'], true)) fail('Invalid status');
            $updates['status'] = $status;
        }
        if (!$updates) fail('No valid fields supplied');
        if ($id === $user['id'] && ((isset($updates['role']) && $updates['role'] !== ($user['role'] ?? null)) || (isset($updates['status']) && $updates['status'] === 'blocked'))) {
            fail('You cannot change your own admin role or block yourself', 422);
        }
        ensureCanChangeAdmin($db, $id, $updates['role'] ?? null, $updates['status'] ?? null);
        $sets = []; $values = [];
        foreach ($updates as $key => $value) { $sets[] = quoted($key).'=?'; $values[] = $value; }
        $values[] = $id;
        try {
            $stmt = $db->prepare('UPDATE users SET '.implode(',', $sets).' WHERE id=?');
            $stmt->execute($values);
        } catch (PDOException $e) { if ($e->getCode() === '23000') fail('A user with this email already exists', 409); throw $e; }
        if (!$stmt->rowCount()) {
            $exists = $db->prepare('SELECT id FROM users WHERE id=?'); $exists->execute([$id]);
            if (!$exists->fetch()) fail('User not found', 404);
        }
        $stmt = $db->prepare('SELECT * FROM users WHERE id=?'); $stmt->execute([$id]);
        respond(publicUser($stmt->fetch()));
    }
    if ($route === 'users/set-password' && $method === 'POST') {
        requireAdmin($user);
        $data = body(); $id = (string)($data['id'] ?? ''); $password = (string)($data['password'] ?? '');
        if (!$id) fail('User id is required');
        if (strlen($password) < 8) fail('Password must be at least 8 characters');
        $stmt = $db->prepare('UPDATE users SET password_hash=?, updated_date=NOW() WHERE id=?');
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        if (!$stmt->rowCount()) fail('User not found', 404);
        $db->prepare('DELETE FROM auth_tokens WHERE user_id=?')->execute([$id]);
        respond(['message'=>'Password updated']);
    }
    if ($route === 'users/block' && $method === 'POST') {
        requireAdmin($user);
        $data = body(); $id = (string)($data['id'] ?? ''); $blocked = (bool)($data['blocked'] ?? true);
        if (!$id) fail('User id is required');
        if ($id === $user['id']) fail('You cannot block yourself', 422);
        $status = $blocked ? 'blocked' : 'active';
        ensureCanChangeAdmin($db, $id, null, $status);
        $stmt = $db->prepare('UPDATE users SET status=?, updated_date=NOW() WHERE id=?');
        $stmt->execute([$status, $id]);
        if (!$stmt->rowCount()) {
            $exists = $db->prepare('SELECT id FROM users WHERE id=?'); $exists->execute([$id]);
            if (!$exists->fetch()) fail('User not found', 404);
        }
        if ($blocked) $db->prepare('DELETE FROM auth_tokens WHERE user_id=?')->execute([$id]);
        $stmt = $db->prepare('SELECT * FROM users WHERE id=?'); $stmt->execute([$id]);
        respond(publicUser($stmt->fetch()));
    }
    if ($route === 'users/delete' && $method === 'POST') {
        requireAdmin($user);
        $data = body(); $id = (string)($data['id'] ?? '');
        if (!$id) fail('User id is required');
        if ($id === $user['id']) fail('You cannot delete yourself', 422);
        ensureCanChangeAdmin($db, $id, null, null, true);
        $stmt = $db->prepare('DELETE FROM users WHERE id=?');
        $stmt->execute([$id]);
        respond(['deleted'=>$stmt->rowCount()]);
    }
    if ($route === 'functions/generateRentReminders' && $method === 'POST') {
        requireAdmin($user);
        $setting=$db->query('SELECT * FROM settings ORDER BY created_date DESC LIMIT 1')->fetch()?:[];
        $grace=(int)($setting['grace_period_days']??5); $day=(int)date('j'); $period=date('Y-m'); $today=date('Y-m-d');
        if($day<=$grace)respond(['message'=>"Still within grace period ($grace days). No reminders sent.",'skipped'=>true,'dayOfMonth'=>$day,'gracePeriod'=>$grace]);
        $stmt=$db->prepare("SELECT t.* FROM tenants t WHERE t.status='Active' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.tenant_id=t.id AND p.period=? AND p.status='Completed')");
        $stmt->execute([$period]); $overdue=$stmt->fetchAll(); $new=[];
        $insert=$db->prepare("INSERT IGNORE INTO rent_reminders (id,tenant_id,property_id,amount_due,period,reminder_date,message,status,channel,created_by) VALUES (?,?,?,?,?,?,?,'Sent','Portal',?)");
        foreach($overdue as $tenant){
            $amount=number_format((float)$tenant['monthly_rent'],0,'.',',');
            $message="Habari {$tenant['full_name']}, kodi ya mwezi $period ya Tsh $amount haijalipwa. Tafadhali lipa deni lako kwa wakati.";
            $id=uuid(); $insert->execute([$id,$tenant['id'],$tenant['property_id'],$tenant['monthly_rent'],$period,$today,$message,$user['id']]);
            if($insert->rowCount())$new[]=['id'=>$id,'tenant'=>$tenant['full_name'],'amount'=>(float)$tenant['monthly_rent']];
        }
        respond(['success'=>true,'overdueCount'=>count($overdue),'newReminders'=>count($new),'period'=>$period,'reminders'=>$new]);
    }
    if ($route === 'integrations/llm' && $method === 'POST') {
        $key=getenv('OPENAI_API_KEY'); $model=getenv('OPENAI_MODEL');
        if(!$key || !$model)fail('AI is not configured. Set OPENAI_API_KEY and OPENAI_MODEL on the PHP server.',503);
        if(!function_exists('curl_init'))fail('PHP cURL extension is required for AI requests.',503);
        $data=body(); $ch=curl_init('https://api.openai.com/v1/responses');
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode(['model'=>$model,'input'=>(string)($data['prompt']??'')])]);
        $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); if($raw===false)fail('AI request failed',502);
        $result=json_decode($raw,true); if($status>=400)fail($result['error']['message']??'AI request failed',$status);
        $text=''; foreach($result['output']??[] as $item)foreach($item['content']??[] as $part)if(($part['type']??'')==='output_text')$text.=$part['text']??'';
        respond(['output'=>$text]);
    }

    if (str_starts_with($route, 'entities/')) {
        $parts=explode('/',$route); $entity=$parts[1]??''; $action=$parts[2]??''; $id=$parts[3]??null;
        if(!isset($entities[$entity]))fail('Unknown entity',404);
        if($entity==='User')requireAdmin($user);
        $meta=$entities[$entity]; $table=$meta['table']; $fields=$meta['fields'];

        if($method==='GET'){
            if($action==='get' && $id){
                $stmt=$db->prepare('SELECT * FROM '.quoted($table).' WHERE id=?');$stmt->execute([$id]);$row=$stmt->fetch();
                if(!$row)fail('Record not found',404); $row=castRows([$row],$meta['numeric'])[0]; if($entity==='User')$row=publicUser($row); respond($row);
            }
            $filter=json_decode((string)($_GET['filter']??'{}'),true); if(!is_array($filter))$filter=[];
            $params=[];$where=whereClause($filter,$fields,$params);
            $sort=(string)($_GET['sort']??'-created_date');$desc=str_starts_with($sort,'-');$sort=ltrim($sort,'-');
            if(!in_array($sort,array_merge($fields,['id','created_date','updated_date']),true))$sort='created_date';
            $limit=max(1,min(5000,(int)($_GET['limit']??500)));
            $stmt=$db->prepare('SELECT * FROM '.quoted($table).$where.' ORDER BY '.quoted($sort).' '.($desc?'DESC':'ASC').' LIMIT '.$limit);
            $stmt->execute($params);$rows=castRows($stmt->fetchAll(),$meta['numeric']); if($entity==='User')$rows=array_map('publicUser',$rows); respond($rows);
        }
        canWrite($entity,$user,$writeRoles);
        $data=cleanData(body(),$fields);
        if($method==='POST' && $action==='bulk'){
            $items=$data; // replaced below because bulk body is an array
        }
        if($method==='POST' && $action==='delete-many'){
            requireAdmin($user);$payload=body();$params=[];$where=whereClause($payload,$fields,$params);
            $db->exec('SET FOREIGN_KEY_CHECKS=0');
            $stmt=$db->prepare('DELETE FROM '.quoted($table).$where);$stmt->execute($params);
            $db->exec('SET FOREIGN_KEY_CHECKS=1');
            respond(['deleted'=>$stmt->rowCount()]);
        }
        if($method==='POST' && $action==='bulk'){
            $items=body();if(!array_is_list($items))fail('Expected an array');
            $db->beginTransaction();$created=[];
            foreach($items as $item){
                $row=validateEntityData($entity,cleanData(is_array($item)?$item:[],$fields));$row['id']=uuid();$row['created_by']=$user['id'];
                $columns=array_keys($row);$stmt=$db->prepare('INSERT INTO '.quoted($table).' ('.implode(',',array_map('quoted',$columns)).') VALUES ('.implode(',',array_fill(0,count($columns),'?')).')');
                $stmt->execute(array_values($row));$created[]=$row;
            }
            $db->commit();respond($created,201);
        }
        if($method==='POST' && $action==='create'){
            $data=validateEntityData($entity,cleanData(body(),$fields));$data['id']=uuid();$data['created_by']=$user['id'];$columns=array_keys($data);
            $stmt=$db->prepare('INSERT INTO '.quoted($table).' ('.implode(',',array_map('quoted',$columns)).') VALUES ('.implode(',',array_fill(0,count($columns),'?')).')');
            $stmt->execute(array_values($data));$stmt=$db->prepare('SELECT * FROM '.quoted($table).' WHERE id=?');$stmt->execute([$data['id']]);$row=castRows([$stmt->fetch()],$meta['numeric'])[0]; if($entity==='User')$row=publicUser($row); respond($row,201);
        }
        if($method==='PUT' && $action==='update' && $id){
            $data=validateEntityData($entity,cleanData(body(),$fields));if(!$data)fail('No valid fields supplied');
            $sets=[];$values=[];foreach($data as $key=>$value){$sets[]=quoted($key).'=?';$values[]=$value;}$values[]=$id;
            $stmt=$db->prepare('UPDATE '.quoted($table).' SET '.implode(',',$sets).' WHERE id=?');$stmt->execute($values);
            $stmt=$db->prepare('SELECT * FROM '.quoted($table).' WHERE id=?');$stmt->execute([$id]);$row=$stmt->fetch();if(!$row)fail('Record not found',404);$row=castRows([$row],$meta['numeric'])[0]; if($entity==='User')$row=publicUser($row); respond($row);
        }
        if($method==='DELETE' && $action==='delete' && $id){
            $db->exec('SET FOREIGN_KEY_CHECKS=0');
            $stmt=$db->prepare('DELETE FROM '.quoted($table).' WHERE id=?');$stmt->execute([$id]);
            $db->exec('SET FOREIGN_KEY_CHECKS=1');
            respond(['deleted'=>$stmt->rowCount()]);
        }
    }
    fail('Route not found',404);
} catch (PDOException $e) {
    $message=$config['app_env']==='development'?$e->getMessage():'Database request failed';
    fail($message,500);
} catch (Throwable $e) {
    fail($config['app_env']==='development'?$e->getMessage():'Server error',500);
}

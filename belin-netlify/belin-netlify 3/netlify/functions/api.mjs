
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const json = (data, status = 200) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(data),
});

const fail = (message, status = 400) =>
  json({ error: message }, status);

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const getDB = () =>
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

const text = (value, max = 2000) =>
  String(value ?? '').trim().slice(0, max);

const parse = (event) => {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
};

const ensure = async (event, db) => {
  const token = (
    event.headers.authorization ||
    event.headers.Authorization ||
    ''
  ).replace(/^Bearer\s+/i, '');

  if (!token) return false;

  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);

  if (error || !user) return false;

  const { data, error: adminError } = await db
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError) throw adminError;
  return !!data;
};

const select = async (db, table, publishedOnly = false) => {
  let query = db.from(table).select('*');

  if (publishedOnly) {
    query = query.eq('published', true);
  }

  if (table === 'projects' || table === 'services' || table === 'templates') {
    query = query.order('sort').order('id');
  } else {
    query = query.order('id', { ascending: false });
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

export const handler = async (event) => {
  try {
    if (required.some((key) => !process.env[key])) {
      return fail(
        'Не настроены переменные Supabase в Netlify.',
        503
      );
    }

    const db = getDB();
    const method = event.httpMethod;

    const path = decodeURIComponent(
      event.path.split('/api/')[1] ||
      event.path.split('/.netlify/functions/api/')[1] ||
      ''
    );

    // Конфигурация для браузера.
    // Секретный service_role ключ не передаётся.

    if (method === 'GET' && path === 'config') {
      return json({
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
      });
    }

    // Публичные данные сайта

    if (method === 'GET' && path === 'public') {
      const [
        settingsResult,
        projects,
        testimonials,
        services,
        templates,
      ] = await Promise.all([
        db.from('site_settings').select('key,value'),
        select(db, 'projects', true),
        select(db, 'testimonials', true),
        select(db, 'services', true),
        select(db, 'templates', true),
      ]);

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      const settings = Object.fromEntries(
        (settingsResult.data || []).map((item) => [
          item.key,
          item.value,
        ])
      );

      delete settings.privacyText;

      return json({
        settings,
        projects,
        testimonials,
        services,
        templates,
      });
    }

    // Политика конфиденциальности

    if (method === 'GET' && path === 'privacy') {
      const { data, error } = await db
        .from('site_settings')
        .select('value')
        .eq('key', 'privacyText')
        .maybeSingle();

      if (error) throw error;

      return json({
        privacyText: data?.value || '',
      });
    }

    // Приём заявок

    if (method === 'POST' && path === 'leads') {
      const body = parse(event);

      if (text(body.website)) {
        return json({ ok: true });
      }

      if (!body.consent) {
        return fail(
          'Необходимо согласие на обработку данных.'
        );
      }

      const { data: rows, error: settingsError } = await db
        .from('site_settings')
        .select('key,value')
        .in('key', ['formsEnabled', 'privacyText']);

      if (settingsError) throw settingsError;

      const settings = Object.fromEntries(
        (rows || []).map((item) => [
          item.key,
          item.value,
        ])
      );

      if (
        settings.formsEnabled !== 'true' ||
        !settings.privacyText?.trim()
      ) {
        return fail(
          'Приём заявок пока отключён.',
          403
        );
      }

      const name = text(body.name, 100);
      const contact = text(body.contact, 150);
      const service = text(body.service, 100);
      const message = text(body.message, 2000);

      if (
        name.length < 2 ||
        contact.length < 4 ||
        String(body.name || '').length > 100 ||
        String(body.contact || '').length > 150
      ) {
        return fail('Проверьте имя и контакты.');
      }

      const ip = (
        event.headers['x-nf-client-connection-ip'] ||
        event.headers['client-ip'] ||
        'unknown'
      ).split(',')[0];

      const hash = createHash('sha256')
        .update(
          ip +
          '|' +
          (
            process.env.LEAD_THROTTLE_SALT ||
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
        )
        .digest('hex');

      const { data: previous, error: throttleError } =
        await db
          .from('lead_throttle')
          .select('last_at')
          .eq('ip_hash', hash)
          .maybeSingle();

      if (throttleError) throw throttleError;

      if (
        previous &&
        Date.now() - Date.parse(previous.last_at) < 60000
      ) {
        return fail(
          'Подождите минуту перед повторной отправкой.',
          429
        );
      }

      const { error } = await db.from('leads').insert({
        name,
        contact,
        service,
        message,
      });

      if (error) throw error;

      const { error: updateError } = await db
        .from('lead_throttle')
        .upsert({
          ip_hash: hash,
          last_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error('Lead throttle update:', updateError);
      }

      return json({ ok: true }, 201);
    }

    // Защита административных маршрутов

    if (!path.startsWith('admin/')) {
      return fail('Маршрут не найден', 404);
    }

    if (!(await ensure(event, db))) {
      return fail(
        'Нет доступа. Проверьте вход и список администраторов.',
        401
      );
    }

    // Все данные административной панели

    if (method === 'GET' && path === 'admin/data') {
      const [
        leads,
        projects,
        testimonials,
        services,
        templates,
        settingsResult,
      ] = await Promise.all([
        select(db, 'leads'),
        select(db, 'projects'),
        select(db, 'testimonials'),
        select(db, 'services'),
        select(db, 'templates'),
        db.from('site_settings').select('key,value'),
      ]);

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      return json({
        leads,
        projects,
        testimonials,
        services,
        templates,
        settings: Object.fromEntries(
          (settingsResult.data || []).map((item) => [
            item.key,
            item.value,
          ])
        ),
      });
    }

    // Настройки сайта

    if (
      method === 'PUT' &&
      path === 'admin/settings'
    ) {
      const body = parse(event);

      const allowed = [
        'brand',
        'heroTitle',
        'heroDescription',
        'email',
        'phone',
        'telegram',
        'address',
        'priceSite',
        'priceSubscription',
        'footerText',
        'logoUrl',
        'logoAlt',
        'formsEnabled',
        'privacyText',
      ];

      const rows = Object.entries(body)
        .filter(([key]) => allowed.includes(key))
        .map(([key, value]) => ({
          key,
          value: text(
            value,
            key === 'privacyText' ? 25000 : 3000
          ),
        }));

      if (
        rows.some(
          (item) =>
            item.key === 'formsEnabled' &&
            item.value === 'true'
        )
      ) {
        const { data, error } = await db
          .from('site_settings')
          .select('value')
          .eq('key', 'privacyText')
          .maybeSingle();

        if (error) throw error;

        if (!text(body.privacyText || data?.value)) {
          return fail(
            'Сначала заполните политику обработки данных.'
          );
        }
      }

      if (rows.length) {
        const { error } = await db
          .from('site_settings')
          .upsert(rows);

        if (error) throw error;
      }

      return json({ ok: true });
    }

    // Изменение статуса заявки

    const leadMatch = path.match(
      /^admin\/leads\/(\d+)$/
    );

    if (method === 'PUT' && leadMatch) {
      const status = text(parse(event).status, 20);

      if (
        ![
          'new',
          'in_progress',
          'done',
          'spam',
        ].includes(status)
      ) {
        return fail('Неверный статус');
      }

      const { error } = await db
        .from('leads')
        .update({ status })
        .eq('id', Number(leadMatch[1]));

      if (error) throw error;

      return json({ ok: true });
    }

    // Кейсы, отзывы и услуги:
    // добавление, редактирование и удаление

    const itemMatch = path.match(
      /^admin\/(projects|testimonials|services|templates)(?:\/(\d+))?$/
    );

    if (itemMatch) {
      const table = itemMatch[1];
      const id = itemMatch[2];
      const body = parse(event);

      // Удаление

      if (method === 'DELETE' && id) {
        const { error } = await db
          .from(table)
          .delete()
          .eq('id', Number(id));

        if (error) throw error;

        return json({ ok: true });
      }

      // Создание или редактирование

      if (
        (method === 'POST' && !id) ||
        (method === 'PUT' && !!id)
      ) {
        let allowed;

        if (table === 'projects') {
          allowed = [
            'title',
            'category',
            'description',
            'image',
            'url',
            'sort',
            'published',
          ];
        } else if (table === 'templates') {
          allowed = ['title','category','description','price','image','demo_url','features','sort','published'];
        } else if (table === 'testimonials') {
          allowed = [
            'name',
            'role',
            'body',
            'published',
          ];
        } else {
          allowed = [
            'title',
            'category',
            'description',
            'price',
            'price_note',
            'image',
            'features',
            'button_text',
            'sort',
            'published',
          ];
        }

        const object = Object.fromEntries(
          allowed
            .filter((key) => key in body)
            .map((key) => {
              let value;

              if (key === 'published') {
                value =
                  body[key] === true ||
                  body[key] === 1 ||
                  body[key] === '1' ||
                  body[key] === 'true';
              } else if (key === 'features') {
                const raw = body[key];
                value = Array.isArray(raw) ? raw : String(raw ?? '').split('\n');
                value = value.map(x => text(x, 500)).filter(Boolean).slice(0, 30);
              } else if (key === 'sort') {
                value = Number(body[key]) || 0;
              } else {
                value = text(
                  body[key],
                  ['description', 'body'].includes(key)
                    ? 4000
                    : 500
                );
              }

              return [key, value];
            })
        );

        if (
          method === 'POST' &&
          !text(object.title || object.name)
        ) {
          return fail('Введите название или имя');
        }

        if (
          'title' in object &&
          !text(object.title)
        ) {
          return fail('Введите название');
        }

        if (
          'name' in object &&
          !text(object.name)
        ) {
          return fail('Введите имя');
        }

        if (
          object.image &&
          !/^(https:\/\/|\/assets\/)/.test(
            object.image
          )
        ) {
          return fail(
            'Ссылка на изображение должна быть HTTPS'
          );
        }

        if (object.demo_url && !/^https:\/\//.test(object.demo_url)) {
          return fail('Ссылка демоверсии должна быть HTTPS');
        }

        if (
          object.url &&
          !/^https:\/\//.test(object.url)
        ) {
          return fail(
            'Ссылка проекта должна быть HTTPS'
          );
        }

        const query = id
          ? db
              .from(table)
              .update(object)
              .eq('id', Number(id))
          : db.from(table).insert(object);

        const { error } = await query;

        if (error) throw error;

        return json({ ok: true });
      }
    }

    // Загрузка изображений в Supabase Storage

    if (
      method === 'POST' &&
      path === 'admin/upload'
    ) {
      const body = parse(event);

      const bytes = Buffer.from(
        String(body.data || ''),
        'base64'
      );

      if (
        bytes.length < 1 ||
        bytes.length > 5 * 1024 * 1024
      ) {
        return fail('Файл должен быть до 5 МБ');
      }

      const types = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/avif': 'avif',
      };

      const ext = types[body.type];

      if (!ext) {
        return fail(
          'Допустимы PNG, JPG, WEBP, AVIF'
        );
      }

      const validPNG =
        ext !== 'png' ||
        bytes.subarray(0, 8).equals(
          Buffer.from('89504e470d0a1a0a', 'hex')
        );

      const validJPG =
        ext !== 'jpg' ||
        bytes.subarray(0, 3).equals(
          Buffer.from('ffd8ff', 'hex')
        );

      const validWEBP =
        ext !== 'webp' ||
        (
          bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP'
        );

      const validAVIF =
        ext !== 'avif' ||
        bytes.toString('ascii', 4, 12) === 'ftyp';

      if (
        !validPNG ||
        !validJPG ||
        !validWEBP ||
        !validAVIF
      ) {
        return fail('Неверный формат файла');
      }

      const name =
        Date.now() +
        '-' +
        createHash('sha256')
          .update(bytes)
          .digest('hex')
          .slice(0, 12) +
        '.' +
        ext;

      const { error } = await db.storage
        .from('site-assets')
        .upload(name, bytes, {
          contentType: body.type,
          upsert: false,
        });

      if (error) throw error;

      const { data } = db.storage
        .from('site-assets')
        .getPublicUrl(name);

      return json({
        url: data.publicUrl,
      });
    }

    return fail('Маршрут не найден', 404);
  } catch (error) {
    console.error('belin api error:', error);

    return fail(
      'Ошибка сервера. Проверьте настройки Supabase и журналы функций.',
      500
    );
  }
};

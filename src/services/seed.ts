/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Role,
  Permission,
  User,
  Category,
  Brand,
  Unit,
  Product,
  Customer,
  Supplier,
  Warehouse,
  Branch,
  PaymentMethod,
  TaxSetting,
  SystemSetting,
  Inventory,
  InventoryMovement,
  Sale,
  SaleItem,
  Invoice,
  ElectronicInvoice,
  AuditLog,
} from '../types';
import { logAuditEvent } from './audit';

export async function runDatabaseSeed(): Promise<{ success: boolean; counts: Record<string, number>; message: string }> {
  const counts: Record<string, number> = {};

  try {
    // 1. الصلاحيات Permissions
    const permissions: Permission[] = [
      { id: 'perm_prod_view', module: 'products', code: 'products:view', nameAr: 'عرض المنتجات والأسعار', description: 'استعراض بيانات المنتجات وقوائم الأسعار' },
      { id: 'perm_prod_create', module: 'products', code: 'products:create', nameAr: 'إضافة منتجات جديدة', description: 'إدخال أصناف وكالونات ومواد جديدة' },
      { id: 'perm_prod_edit', module: 'products', code: 'products:edit', nameAr: 'تعديل المنتجات والأسعار', description: 'تحديث بيانات الصنف والتسعير' },
      { id: 'perm_prod_delete', module: 'products', code: 'products:delete', nameAr: 'حذف منتجات', description: 'إلغاء تنشيط أو حذف الأصناف' },
      { id: 'perm_inv_view', module: 'inventory', code: 'inventory:view', nameAr: 'عرض أرصدة المخزون', description: 'متابعة الكميات المتوفرة في المستودعات' },
      { id: 'perm_inv_adjust', module: 'inventory', code: 'inventory:adjust', nameAr: 'تسوية الجرد والمخزون', description: 'تعديل الكميات وإثبات الفاقد والتالف' },
      { id: 'perm_inv_transfer', module: 'inventory', code: 'inventory:transfer', nameAr: 'التحويل بين المستودعات', description: 'نقل البضائع بين الفروع والمخازن' },
      { id: 'perm_sales_create', module: 'sales', code: 'sales:create', nameAr: 'إنشاء فواتير بيع POS', description: 'إصدار فواتير نقاط البيع للمقاولين والزبائن' },
      { id: 'perm_sales_discount', module: 'sales', code: 'sales:discount', nameAr: 'منح خصومات تجارية', description: 'تطبيق خصم إضافي على الفواتير' },
      { id: 'perm_sales_return', module: 'sales', code: 'sales:return', nameAr: 'إجراء مرتجعات المبيعات', description: 'قبول إعادة البضاعة واسترداد المبالغ' },
      { id: 'perm_purch_create', module: 'purchases', code: 'purchases:create', nameAr: 'إدخال فواتير المشتريات', description: 'تسجيل بضائع الموردين وأوامر التوريد' },
      { id: 'perm_cust_manage', module: 'customers', code: 'customers:manage', nameAr: 'إدارة حسابات المقاولين', description: 'إضافة عملاء وتحديد الأسقف الائتمانية' },
      { id: 'perm_supp_manage', module: 'suppliers', code: 'suppliers:manage', nameAr: 'إدارة حسابات الموردين', description: 'إضافة ومتابعة مستحقات الموردين' },
      { id: 'perm_users_manage', module: 'users', code: 'users:manage', nameAr: 'إدارة الموظفين والصلاحيات', description: 'إنشاء وتعديل مستخدمي النظام' },
      { id: 'perm_settings_manage', module: 'settings', code: 'settings:manage', nameAr: 'إدارة إعدادات النظام والضريبة', description: 'تعديل إعدادات ZATCA والفروع' },
      { id: 'perm_audit_view', module: 'reports', code: 'audit:view', nameAr: 'استعراض سجلات التدقيق', description: 'الاطلاع على الحركات الأمنية وسجل العمليات' },
    ];

    for (const p of permissions) {
      await setDoc(doc(db, 'permissions', p.id), p);
    }
    counts['permissions'] = permissions.length;

    // 2. الأدوار Roles
    const roles: Role[] = [
      {
        id: 'role_owner',
        nameAr: 'الدعم الفني Admin',
        nameEn: 'System Owner',
        key: 'system_owner',
        description: 'صلاحيات مطلقة لإدارة المنشأة والفروع والمستخدمين والتقارير المالية والضريبية',
        isSystem: true,
        permissionIds: permissions.map((p) => p.id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'role_manager',
        nameAr: 'مدير المنشأة / الفرع',
        nameEn: 'Branch Manager',
        key: 'manager',
        description: 'إدارة المبيعات والمخزون واعتماد أسعار المقاولين والمرتجعات والمشتريات',
        isSystem: true,
        permissionIds: [
          'perm_prod_view', 'perm_prod_create', 'perm_prod_edit',
          'perm_inv_view', 'perm_inv_adjust', 'perm_inv_transfer',
          'perm_sales_create', 'perm_sales_discount', 'perm_sales_return',
          'perm_purch_create', 'perm_cust_manage', 'perm_supp_manage',
          'perm_audit_view',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'role_cashier',
        nameAr: 'كاشير نقطة البيع POS',
        nameEn: 'POS Cashier',
        key: 'cashier',
        description: 'إصدار فواتير نقدية وشبكة، تحصيل المبالغ، وقراءة الباركود',
        isSystem: true,
        permissionIds: ['perm_prod_view', 'perm_sales_create'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'role_sales',
        nameAr: 'موظف مبيعات المقاولين',
        nameEn: 'Contractor Sales Rep',
        key: 'sales_rep',
        description: 'إعداد عروض الأسعار، مبيعات الآجل للمقاولين، ومتابعة المشاريع',
        isSystem: true,
        permissionIds: ['perm_prod_view', 'perm_sales_create', 'perm_cust_manage', 'perm_inv_view'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'role_inventory',
        nameAr: 'موظف وأمين المخزون',
        nameEn: 'Inventory Officer',
        key: 'inventory_officer',
        description: 'استلام بضائع الموردين، تسويات الجرد، ومراقبة النواقص وتجهيز طلبيات الورش',
        isSystem: true,
        permissionIds: ['perm_prod_view', 'perm_inv_view', 'perm_inv_adjust', 'perm_inv_transfer', 'perm_purch_create'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const r of roles) {
      await setDoc(doc(db, 'roles', r.id), r);
    }
    counts['roles'] = roles.length;

    // 3. الفروع والمستودعات Branches & Warehouses
    const branch: Branch = {
      id: 'branch_main',
      nameAr: 'الفرع الرئيسي - شارع المقاولين والصناعية',
      code: 'BR-01',
      city: 'الرياض',
      address: 'طريق الخرج القديم، مجمع مواد البناء، مخرج 17',
      phone: '+966114889900',
      isMain: true,
      isActive: true,
    };
    await setDoc(doc(db, 'branches', branch.id), branch);
    counts['branches'] = 1;

    const warehouses: Warehouse[] = [
      {
        id: 'wh_main',
        nameAr: 'المستودع المركزي للبضائع والمواد الثقيلة',
        code: 'WH-MAIN',
        branchId: 'branch_main',
        location: 'المستودع الرئيسي - هنجر 3',
        managerName: 'طارق العتيبي',
        isPrimary: true,
        isActive: true,
      },
      {
        id: 'wh_locks',
        nameAr: 'مخزن الأقفال والكالونات والإكسسوارات الدقيقة',
        code: 'WH-LOCKS',
        branchId: 'branch_main',
        location: 'معرض العرض - قسم الأقفال الآمنة',
        managerName: 'أحمد النجار',
        isPrimary: false,
        isActive: true,
      },
      {
        id: 'wh_chemical',
        nameAr: 'مستودع العوازل ومواد السيليكون والفلين',
        code: 'WH-CHEM',
        branchId: 'branch_main',
        location: 'هنجر المواد الكيميائية المعزول حرارياً',
        managerName: 'سلطان ممدوح',
        isPrimary: false,
        isActive: true,
      },
    ];
    for (const w of warehouses) {
      await setDoc(doc(db, 'warehouses', w.id), w);
    }
    counts['warehouses'] = warehouses.length;

    // 4. المستخدمين Users
    const users: User[] = [
      {
        id: 'user_owner',
        email: 'owner@emadco.sa',
        fullName: 'عماد سعد آل سعيد (الدعم الفني Admin)',
        phone: '0501112233',
        roleId: 'role_owner',
        roleKey: 'system_owner',
        branchId: 'branch_main',
        warehouseId: 'wh_main',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user_manager',
        email: 'manager@emadco.sa',
        fullName: 'أ. خالد المنصور',
        phone: '0502223344',
        roleId: 'role_manager',
        roleKey: 'manager',
        branchId: 'branch_main',
        warehouseId: 'wh_main',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user_cashier',
        email: 'cashier@emadco.sa',
        fullName: 'سعد القحطاني',
        phone: '0503334455',
        roleId: 'role_cashier',
        roleKey: 'cashier',
        branchId: 'branch_main',
        warehouseId: 'wh_locks',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user_sales',
        email: 'sales@emadco.sa',
        fullName: 'فهد الدوسري',
        phone: '0504445566',
        roleId: 'role_sales',
        roleKey: 'sales_rep',
        branchId: 'branch_main',
        warehouseId: 'wh_main',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user_inventory',
        email: 'inventory@emadco.sa',
        fullName: 'طارق العتيبي',
        phone: '0505556677',
        roleId: 'role_inventory',
        roleKey: 'inventory_officer',
        branchId: 'branch_main',
        warehouseId: 'wh_main',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const u of users) {
      await setDoc(doc(db, 'users', u.id), u);
      // user_roles
      await setDoc(doc(db, 'user_roles', `ur_${u.id}`), {
        id: `ur_${u.id}`,
        userId: u.id,
        roleId: u.roleId,
        assignedAt: new Date().toISOString(),
        assignedBy: 'system',
      });
    }
    counts['users'] = users.length;
    counts['user_roles'] = users.length;

    // 5. التصنيفات Categories (المطابقة لطلب العميل بدقة)
    const categories: Category[] = [
      { id: 'cat_padlocks', nameAr: 'أقفال', nameEn: 'Padlocks & Security Locks', code: 'CAT-PAD', icon: 'Lock', isActive: true, displayOrder: 1 },
      { id: 'cat_locks', nameAr: 'كالونات', nameEn: 'Door Mortise & Cylinders', code: 'CAT-LCK', icon: 'Key', isActive: true, displayOrder: 2 },
      { id: 'cat_pliers', nameAr: 'زراديات', nameEn: 'Pliers & Grips', code: 'CAT-PLR', icon: 'Scissors', isActive: true, displayOrder: 3 },
      { id: 'cat_tools', nameAr: 'العدد', nameEn: 'Tools & Workshop Equipment', code: 'CAT-TLS', icon: 'Wrench', isActive: true, displayOrder: 4 },
      { id: 'cat_contractors', nameAr: 'مواد المقاولين', nameEn: 'Contractor Supplies & Chemicals', code: 'CAT-CON', icon: 'Building', isActive: true, displayOrder: 5 },
      { id: 'cat_foam', nameAr: 'مواد الفلين', nameEn: 'Foam & Insulation Materials', code: 'CAT-FOM', icon: 'Layers', isActive: true, displayOrder: 6 },
      { id: 'cat_frames', nameAr: 'مستلزمات البراويز', nameEn: 'Mouldings & Frame Accessories', code: 'CAT-FRM', icon: 'Frame', isActive: true, displayOrder: 7 },
      { id: 'cat_fasteners', nameAr: 'مواد التثبيت', nameEn: 'Fasteners & Anchors', code: 'CAT-FST', icon: 'Anchor', isActive: true, displayOrder: 8 },
    ];
    for (const c of categories) {
      await setDoc(doc(db, 'categories', c.id), c);
    }
    counts['categories'] = categories.length;

    // 6. الماركات Brands
    const brands: Brand[] = [
      { id: 'br_ahram', nameAr: 'أهرام (Ahram)', nameEn: 'Ahram Locks', countryOfOrigin: 'مصر', isActive: true },
      { id: 'br_yale', nameAr: 'ييل (Yale)', nameEn: 'Yale Security', countryOfOrigin: 'السويد', isActive: true },
      { id: 'br_kale', nameAr: 'كالي (Kale Kilit)', nameEn: 'Kale Kilit', countryOfOrigin: 'تركيا', isActive: true },
      { id: 'br_total', nameAr: 'توتال تولز (Total)', nameEn: 'Total Tools', countryOfOrigin: 'الصين / تقنية صناعية', isActive: true },
      { id: 'br_pattex', nameAr: 'باتكس (Pattex)', nameEn: 'Henkel Pattex', countryOfOrigin: 'ألمانيا', isActive: true },
      { id: 'br_fischer', nameAr: 'فيشر (Fischer)', nameEn: 'Fischer Fixings', countryOfOrigin: 'ألمانيا', isActive: true },
      { id: 'br_stanley', nameAr: 'ستانلي (Stanley)', nameEn: 'Stanley Black & Decker', countryOfOrigin: 'الولايات المتحدة', isActive: true },
      { id: 'br_saveto', nameAr: 'سافيتو (Saveto)', nameEn: 'Saveto Building Materials', countryOfOrigin: 'المملكة العربية السعودية', isActive: true },
    ];
    for (const b of brands) {
      await setDoc(doc(db, 'brands', b.id), b);
    }
    counts['brands'] = brands.length;

    // 7. وحدات القياس Units
    const units: Unit[] = [
      { id: 'unit_piece', nameAr: 'حبة (قطعة)', symbolAr: 'حبة', nameEn: 'Piece', isFractional: false },
      { id: 'unit_set', nameAr: 'طقم كامل', symbolAr: 'طقم', nameEn: 'Set', isFractional: false },
      { id: 'unit_box', nameAr: 'علبة / كرتون', symbolAr: 'علبة', nameEn: 'Box', isFractional: false },
      { id: 'unit_pack', nameAr: 'كيس (1000 حبة)', symbolAr: 'كيس', nameEn: 'Pack 1000', isFractional: false },
      { id: 'unit_tube', nameAr: 'أنبوبة / تيوب', symbolAr: 'أنبوبة', nameEn: 'Tube', isFractional: false },
      { id: 'unit_meter', nameAr: 'متر طولي', symbolAr: 'م.ط', nameEn: 'Meter', isFractional: true },
      { id: 'unit_roll', nameAr: 'لفة كاملة', symbolAr: 'لفة', nameEn: 'Roll', isFractional: false },
    ];
    for (const un of units) {
      await setDoc(doc(db, 'units', un.id), un);
    }
    counts['units'] = units.length;

    // 8. المنتجات Products (بما يطابق الـ 8 تصنيفات لطلب العميل)
    const products: Product[] = [
      // 1. أقفال (cat_padlocks)
      {
        id: 'prod_gate_padlock',
        sku: 'LCK-SAB-90G',
        barcode: '8012345090123',
        nameAr: 'قفل بوابة حديد مصفح ساب إيطالي 90 ملم فولاذ مقسى',
        nameEn: 'Italian Hardened Steel Monoblock Gate Padlock 90mm',
        description: 'قفل كتلة واحدة (Monoblock) للبوابات الحديدية ومستودعات المقاولين، مقاوم للقص بالمنشار والرطوبة والصدمات.',
        categoryId: 'cat_padlocks',
        brandId: 'br_kale',
        baseUnitId: 'unit_piece',
        costPrice: 90.0,
        retailPrice: 135.0,
        wholesalePrice: 115.0,
        contractorPrice: 108.0,
        taxRate: 15,
        minStockLevel: 15,
        maxStockLevel: 150,
        imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'جسم فولاذ صلب معالج، خابور إغلاق فولاذي 12 ملم، 4 مفاتيح نيكل كروم مضادة للنسخ',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_brass_padlock',
        sku: 'LCK-AHR-60B',
        barcode: '6221045009871',
        nameAr: 'قفل نحاس أصلي أهرام 60 ملم ذراع طويل مع مفاتيح كمبيوتر',
        nameEn: 'Ahram Solid Brass Long Shackle Padlock 60mm',
        description: 'قفل أمان نحاسي نقي مقاوم للصدأ والعوامل الجوية الخارجية مع ذراع طويل مصفح للأبواب والمخازن.',
        categoryId: 'cat_padlocks',
        brandId: 'br_ahram',
        baseUnitId: 'unit_piece',
        costPrice: 42.0,
        retailPrice: 65.0,
        wholesalePrice: 54.0,
        contractorPrice: 50.0,
        taxRate: 15,
        minStockLevel: 25,
        maxStockLevel: 200,
        imageUrl: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'جسم نحاس أصفر صب، ذراع صلب مقوى مقاوم للقص، 4 مفاتيح كمبيوتر كمبيوترية',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 2. كالونات (cat_locks)
      {
        id: 'prod_kalon_ahram',
        sku: 'LCK-AHR-70C',
        barcode: '6221045001289',
        nameAr: 'كالون باب أهرام كمبيوتر أصلي 70 ملم سلندر نحاس',
        nameEn: 'Ahram Original Computer Cylinder Mortise Lock 70mm',
        description: 'كالون دفن عالي الأمان مع سلندر نحاسي و5 مفاتيح كمبيوتر مشفرة ومقاومة للنسخ، مناسب للأبواب الخشبية والمعدنية.',
        categoryId: 'cat_locks',
        brandId: 'br_ahram',
        baseUnitId: 'unit_set',
        costPrice: 65.0,
        retailPrice: 95.0,
        wholesalePrice: 82.0,
        contractorPrice: 78.0,
        taxRate: 15,
        minStockLevel: 20,
        maxStockLevel: 250,
        imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'مقاس 70 ملم، لسان نحاسي مزدوج، سلندر 68 ملم كمبيوتر، مع وش استانلس ستيل',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_smart_doorlock',
        sku: 'LCK-YAL-SMART',
        barcode: '8809234812399',
        nameAr: 'كالون باب ذكي إلكتروني ييل سمارت ببصمة الإصبع ورمز PIN للأبواب المصفحة',
        nameEn: 'Yale Smart Fingerprint, PIN & Bluetooth Digital Mortise Door Lock',
        description: 'قفل ذكي معاصر للمنازل والمكاتب، يدعم بصمة الإصبع الحيوية، شاشة لمس لكود الدخول، كارت ذكي ومفتاح طوارئ ميكانيكي.',
        categoryId: 'cat_locks',
        brandId: 'br_yale',
        baseUnitId: 'unit_set',
        costPrice: 450.0,
        retailPrice: 680.0,
        wholesalePrice: 580.0,
        contractorPrice: 540.0,
        taxRate: 15,
        minStockLevel: 10,
        maxStockLevel: 80,
        imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'شاشة لمسية مضادة للبصمات، إنذار اقتحام، ذاكرة 100 بصمة، مدخل شحن طوارئ Type-C',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_cylinder_kale',
        sku: 'LCK-KLE-68B',
        barcode: '8691234509123',
        nameAr: 'سلندر كالون كالي تركي نحاس أصلي 68 ملم كمبيوتر مع 5 مفاتيح',
        nameEn: 'Kale Kilit High Security Brass Euro Profile Cylinder 68mm',
        description: 'قلب كالون أمان تركي نحاسي أصلي مقاوم للكسر والحفر، قياس عالمي متطابق مع جميع الأبواب.',
        categoryId: 'cat_locks',
        brandId: 'br_kale',
        baseUnitId: 'unit_piece',
        costPrice: 35.0,
        retailPrice: 55.0,
        wholesalePrice: 45.0,
        contractorPrice: 42.0,
        taxRate: 15,
        minStockLevel: 30,
        maxStockLevel: 300,
        imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'طول 68 ملم (34+34)، بنادق نحاس مضادة للالتقاط، 5 مفاتيح كمبيوتر مدمجة',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 3. زراديات (cat_pliers)
      {
        id: 'prod_pliers_total',
        sku: 'TLS-TOT-PL8',
        barcode: '6925582103445',
        nameAr: 'زرادية كهرباء وميكانيكا معزولة 8 بوصة توتال صناعي 1000V',
        nameEn: 'Total 8" Heavy Duty Combination Insulated Pliers 1000V',
        description: 'زرادية متعددة الوظائف للمقاولين والفنيين مع مقبض مطاطي مانع للانزلاق ومعزول حتى 1000 فولت.',
        categoryId: 'cat_pliers',
        brandId: 'br_total',
        baseUnitId: 'unit_piece',
        costPrice: 28.0,
        retailPrice: 42.0,
        wholesalePrice: 36.0,
        contractorPrice: 33.0,
        taxRate: 15,
        minStockLevel: 30,
        maxStockLevel: 300,
        imageUrl: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'فولاذ كربومي مقوى بالحرارة، طول 200 ملم (8 بوصة)، شفرات قطع أسلاك مدمجة',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_locking_pliers',
        sku: 'TLS-STN-LP10',
        barcode: '076174842104',
        nameAr: 'زرادية قفش (كلابة حدادة ولحام) 10 بوصة ستانلي فك منحنٍ',
        nameEn: 'Stanley 10" Curved Jaw Heavy Duty Locking Pliers / Vise-Grip',
        description: 'كلابة تثبيت وقفش قوية للمقاولين وأعمال السباكة والحدادة مع مسمار ضبط عزم الربط الدقيق.',
        categoryId: 'cat_pliers',
        brandId: 'br_stanley',
        baseUnitId: 'unit_piece',
        costPrice: 38.0,
        retailPrice: 58.0,
        wholesalePrice: 49.0,
        contractorPrice: 45.0,
        taxRate: 15,
        minStockLevel: 20,
        maxStockLevel: 150,
        imageUrl: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'فولاذ كروم فانديوم Cr-V عالي الصلابة، مقاس 250 ملم (10 بوصة)، قفل تحرير سريع',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 4. العدد (cat_tools)
      {
        id: 'prod_hammer_drill',
        sku: 'TLS-TOT-RH800',
        barcode: '6925582109812',
        nameAr: 'دريل هلتي تكسير وتخريم 800 واط توتال صناعي SDS-Plus مع حقيبة بنط',
        nameEn: 'Total Rotary Hammer Drill 800W SDS-Plus Heavy Duty',
        description: 'مطرقة دوارة وهلتي تخريم في الخرسانة والحديد والطوب مع 3 وظائف ومقبض مضاد للاهتزاز للمشاريع الإنشائية.',
        categoryId: 'cat_tools',
        brandId: 'br_total',
        baseUnitId: 'unit_set',
        costPrice: 220.0,
        retailPrice: 320.0,
        wholesalePrice: 275.0,
        contractorPrice: 255.0,
        taxRate: 15,
        minStockLevel: 10,
        maxStockLevel: 60,
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'قدرة 800W، طاقة صدم 2.5 جول، رأس ظرف SDS-Plus، حقيبة بلاستيكية متكاملة مع 3 ريش وبنطة إزميل',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_tape_measure',
        sku: 'TLS-STN-TM8M',
        barcode: '076174338080',
        nameAr: 'شريط قياس متري معدني 8 متر ستانلي شريط عريض مقاوم للانكسار',
        nameEn: 'Stanley PowerLock 8m/26ft Heavy Duty Measuring Tape',
        description: 'متر قياس مهني للمقاولين ومسؤولي المواقع، هيكل مصفح مضاد للصدمات مع طلاء مايلر الواقي من التآكل.',
        categoryId: 'cat_tools',
        brandId: 'br_stanley',
        baseUnitId: 'unit_piece',
        costPrice: 25.0,
        retailPrice: 39.0,
        wholesalePrice: 32.0,
        contractorPrice: 29.5,
        taxRate: 15,
        minStockLevel: 40,
        maxStockLevel: 400,
        imageUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'طول 8 متر، شريط صلب عريض 25 ملم، خطاف طرفي ثلاثي التثبيت، قفل أوتوماتيكي',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 5. مواد المقاولين (cat_contractors)
      {
        id: 'prod_bonding_agent',
        sku: 'CON-SVT-BND4L',
        barcode: '6281098715541',
        nameAr: 'مادة رابطة ولاصق خرساني سافيتو بوند (أديبوند) جالون 4 لتر',
        nameEn: 'Saveto SBR Concrete Bonding Agent & Admixture 4L',
        description: 'مستحلب بوليمري عالي الجودة لتعزيز التصاق اللياسة والخرسانة وعزل المياه ومنع الشروخ والتصدعات.',
        categoryId: 'cat_contractors',
        brandId: 'br_saveto',
        baseUnitId: 'unit_tube',
        costPrice: 48.0,
        retailPrice: 72.0,
        wholesalePrice: 62.0,
        contractorPrice: 58.0,
        taxRate: 15,
        minStockLevel: 30,
        maxStockLevel: 300,
        imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'سعة 4 لتر، أساس ستيرين بوتادين SBR، مطابقة لمواصفات كود البناء السعودي',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_tile_adhesive',
        sku: 'CON-SVT-VETOP',
        barcode: '6281098712311',
        nameAr: 'غراء بلاط وسيراميك وبورسلان سافيتو فيتوفيكس كيس 20 كجم',
        nameEn: 'Saveto Vetonit High Performance Tile & Porcelain Adhesive 20kg',
        description: 'ملاط إسمنتي معدل بالبوليمرات لتثبيت بلاط السيراميك والبورسلان للأرضيات والجدران الداخلية والخارجية.',
        categoryId: 'cat_contractors',
        brandId: 'br_saveto',
        baseUnitId: 'unit_pack',
        costPrice: 22.0,
        retailPrice: 32.0,
        wholesalePrice: 27.0,
        contractorPrice: 25.0,
        taxRate: 15,
        minStockLevel: 100,
        maxStockLevel: 1500,
        imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'شيكارة وزن 20 كجم، مقاوم للانزلاق العمودي، تغطية تقريبية 4-5 م² لكل كيس',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 6. مواد الفلين (cat_foam)
      {
        id: 'prod_foam_adhesive',
        sku: 'FOM-SVT-750P',
        barcode: '6281098712399',
        nameAr: 'مادة تثبيت فلين ولاصق رغوي بوليوريثان عازل للمقاولين 750 مل',
        nameEn: 'Saveto High-Adhesion PU Foam Adhesive for EPS/XPS Insulation 750ml',
        description: 'رغوة بوليوريثان لاصقة مخصصة لتثبيت ألواح الفلين والعزل الحراري والصوتي على الجدران والأسقف بقوة التصاق فائقة.',
        categoryId: 'cat_foam',
        brandId: 'br_saveto',
        baseUnitId: 'unit_tube',
        costPrice: 24.0,
        retailPrice: 38.0,
        wholesalePrice: 31.0,
        contractorPrice: 28.5,
        taxRate: 15,
        minStockLevel: 50,
        maxStockLevel: 600,
        imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'سعة 750 مل، تمدد منخفض لمنع تشوه الألواح، جاهز للتشطيب خلال 60 دقيقة',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_foam_sheets',
        sku: 'FOM-EPS-50MM',
        barcode: '6281098712990',
        nameAr: 'ألواح فلين عازل حراري بوليستيرين أزرق كثافة 35 كجم سمك 5 سم (لوح 125×60 سم)',
        nameEn: 'Extruded Polystyrene (XPS) Rigid Insulation Foam Board 50mm',
        description: 'ألواح فلين عازل مضغوط عالي الكثافة لأسطح وجدران المباني والمخازن المبردة، مقاوم لنفاذ بخار الماء وضغط الأحمال.',
        categoryId: 'cat_foam',
        brandId: 'br_saveto',
        baseUnitId: 'unit_piece',
        costPrice: 18.0,
        retailPrice: 28.0,
        wholesalePrice: 23.5,
        contractorPrice: 21.0,
        taxRate: 15,
        minStockLevel: 80,
        maxStockLevel: 1000,
        imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'كثافة 35 كجم/م³، سمك 50 ملم، مقاومة حريق تصنيف B2، أبعاد 125×60 سم',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 7. مستلزمات البراويز (cat_frames)
      {
        id: 'prod_frame_fixtures',
        sku: 'FRM-ACC-CORNER',
        barcode: '6285551209844',
        nameAr: 'إكسسوار وزاوية تثبيت براويز وكرانيش ديكور معدنية مجلفنة (طقم 100 قطعة)',
        nameEn: 'Heavy Duty Metal Frame Corner Brackets & Moldings Fixings (100 Pcs)',
        description: 'زوايا فولاذية مقواة بفتحات غاطسة لتثبيت براويز الأبواب، إطارات الديكور، والقواطع الخشبية بأعلى متانة واستقامة.',
        categoryId: 'cat_frames',
        brandId: 'br_stanley',
        baseUnitId: 'unit_box',
        costPrice: 30.0,
        retailPrice: 48.0,
        wholesalePrice: 40.0,
        contractorPrice: 36.0,
        taxRate: 15,
        minStockLevel: 25,
        maxStockLevel: 300,
        imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'فولاذ مجلفن سمك 2 ملم، أبعاد 50×50 ملم، مجهزة بـ 4 ثقوب تثبيت مع البراغي',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_miter_glue',
        sku: 'FRM-GLU-MITRE',
        barcode: '8698765430129',
        nameAr: 'غراء فوري للبراويز والديكور وإطارات MDF مع سبراي منشط تركي 400 مل',
        nameEn: 'Fast Action 2K Cyanoacrylate Adhesive with Activator Spray for Picture Frames & MDF',
        description: 'لاصق ثنائي فوري شديد الالتصاق لتجميع زوايا البراويز والإطارات الخشبية والـ MDF والكرانيش خلال 10 ثوانٍ فقط.',
        categoryId: 'cat_frames',
        brandId: 'br_pattex',
        baseUnitId: 'unit_set',
        costPrice: 16.0,
        retailPrice: 26.0,
        wholesalePrice: 21.0,
        contractorPrice: 19.5,
        taxRate: 15,
        minStockLevel: 40,
        maxStockLevel: 500,
        imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'عبوة جل 100 جم + سبراي منشط 400 مل، التصاق قوي مقاوم للرطوبة والهزات',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },

      // 8. مواد التثبيت (cat_fasteners)
      {
        id: 'prod_screws_drywall',
        sku: 'SCR-FSH-3525',
        barcode: '4048962012448',
        nameAr: 'مسامير وبراغي جبس بورد صلب أسود مقسى 3.5×25 ملم (علبة 1000 حبة)',
        nameEn: 'Hardened Black Drywall Screws 3.5x25mm (Box 1000 pcs)',
        description: 'براغي سن صاج خشنة سريعة الاختراق لتركيب ألواح الجبس بورد في القواطع المعدنية والخشبية دون تشقق.',
        categoryId: 'cat_fasteners',
        brandId: 'br_fischer',
        baseUnitId: 'unit_pack',
        costPrice: 22.0,
        retailPrice: 35.0,
        wholesalePrice: 28.0,
        contractorPrice: 25.5,
        taxRate: 15,
        minStockLevel: 40,
        maxStockLevel: 500,
        imageUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'فولاذ فوسفاتي أسود مقاوم للتآكل، رأس بوقي فائق الغوص، علبة سعة 1000 برغي',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_fischer_anchors',
        sku: 'SCR-FSH-SX8',
        barcode: '4048962001121',
        nameAr: 'خابير وفيشر أصلي ألماني فيشر نايلون SX Plus مقاس 8×40 ملم (علبة 100 حبة)',
        nameEn: 'Fischer SX Plus High Expansion Universal Nylon Wall Plugs 8x40mm (Box 100)',
        description: 'فيشر نايلون أصلي تمدد رباعي للمقاولين، يمسك بقوة استثنائية في الخرسانة الصلبة، الطوب المفرغ والجبس.',
        categoryId: 'cat_fasteners',
        brandId: 'br_fischer',
        baseUnitId: 'unit_pack',
        costPrice: 15.0,
        retailPrice: 25.0,
        wholesalePrice: 20.0,
        contractorPrice: 18.0,
        taxRate: 15,
        minStockLevel: 50,
        maxStockLevel: 800,
        imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'نايلون بولياميد عالي النقاء، قطر 8 ملم، طول 40 ملم، علبة 100 خابور',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'prod_concrete_anchor',
        sku: 'SCR-ANK-1080',
        barcode: '6281098719041',
        nameAr: 'مسامير وخوابير خرسانة أنكر بولت حديد مجلفن للأحمال الثقيلة 10×80 ملم (طقم 25 حبة)',
        nameEn: 'Heavy Duty Wedge Concrete Anchor Bolts Zinc Plated 10x80mm (Pack 25)',
        description: 'براغي تثبيت خرسانية ميكانيكية ثقيلة لتثبيت بوابات الحديد، الهياكل المعدنية، والمعدات الإنشائية في الأسمنت.',
        categoryId: 'cat_fasteners',
        brandId: 'br_fischer',
        baseUnitId: 'unit_box',
        costPrice: 28.0,
        retailPrice: 45.0,
        wholesalePrice: 38.0,
        contractorPrice: 34.0,
        taxRate: 15,
        minStockLevel: 25,
        maxStockLevel: 300,
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80',
        isActive: true,
        specifications: 'حديد صلب مجلفن مقاوم للصدأ، قطر 10 ملم، طول 80 ملم، مع الصواميل والوردات',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const p of products) {
      await setDoc(doc(db, 'products', p.id), p);
    }
    counts['products'] = products.length;

    // 9. العملاء والموردين Customers & Suppliers
    const customers: Customer[] = [
      {
        id: 'cust_al_abraj',
        customerType: 'contractor',
        name: 'شركة الأبراج للمقاولات العامة والإنشاءات',
        phone: '0551234567',
        email: 'projects@alabraj-contracting.com',
        taxNumber: '300984729100003',
        commercialRegister: '1010892341',
        address: 'حي الملز، الرياض، شارع الستين',
        creditLimit: 150000,
        currentBalance: 34500,
        priceTier: 'contractor',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cust_modern_build',
        customerType: 'company',
        name: 'مؤسسة البناء الحديث للتطوير والتشطيبات',
        phone: '0569876543',
        email: 'procurement@modernbuild.sa',
        taxNumber: '310458291000003',
        commercialRegister: '1010447289',
        address: 'حي السلي، مستودعات المقاولين، الرياض',
        creditLimit: 75000,
        currentBalance: 12400,
        priceTier: 'wholesale',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cust_doors_workshop',
        customerType: 'contractor',
        name: 'ورشة الأمان لتصنيع وتركيب الأبواب والشبابيك',
        phone: '0543338899',
        address: 'المنطقة الصناعية القديمة، ورشة رقم 42',
        creditLimit: 25000,
        currentBalance: 0,
        priceTier: 'contractor',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cust_walk_in',
        customerType: 'individual',
        name: 'عميل نقدي مباشر / أفراد',
        phone: '0500000000',
        creditLimit: 0,
        currentBalance: 0,
        priceTier: 'retail',
        createdAt: new Date().toISOString(),
      },
    ];
    for (const c of customers) {
      await setDoc(doc(db, 'customers', c.id), c);
    }
    counts['customers'] = customers.length;

    const suppliers: Supplier[] = [
      {
        id: 'supp_ahram_factory',
        companyName: 'مصنع الأهرام للأقفال والمنتجات المعدنية',
        contactPerson: 'م. أحمد شكري',
        phone: '+201004928192',
        email: 'export@ahram-security.com',
        taxNumber: '3998271000003',
        address: 'المدينة الصناعية، العاشر من رمضان',
        balance: 45000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'supp_total_distributor',
        companyName: 'شركة التوريدات الصناعية للعدد والآلات (وكيل Total)',
        contactPerson: 'أ. سامر الحلواني',
        phone: '0112448899',
        email: 'sales@industriallink.sa',
        taxNumber: '300184920000003',
        address: 'شارع الريل، حي الديرة، الرياض',
        balance: 18500,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'supp_chemical_materials',
        companyName: 'الشركة العربية للكيماويات ومواد البناء (باتكس وسافيتو)',
        contactPerson: 'م. طارق عبد الرزاق',
        phone: '0114920011',
        email: 'orders@arabchem-sa.com',
        taxNumber: '310992384000003',
        address: 'المدينة الصناعية الثانية، الرياض',
        balance: 29000,
        createdAt: new Date().toISOString(),
      },
    ];
    for (const s of suppliers) {
      await setDoc(doc(db, 'suppliers', s.id), s);
    }
    counts['suppliers'] = suppliers.length;

    // 10. المخزون والحركات Inventory & Movements
    for (const p of products) {
      const inv: Inventory = {
        id: `inv_${p.id}_wh_main`,
        productId: p.id,
        warehouseId: 'wh_main',
        quantityOnHand: Math.floor(Math.random() * 80) + 40,
        reservedQuantity: 5,
        availableQuantity: Math.floor(Math.random() * 80) + 35,
        averageCost: p.costPrice,
        lastUpdated: new Date().toISOString(),
      };
      await setDoc(doc(db, 'inventory', inv.id), inv);

      // سجل حركة افتتاحية
      const movement: InventoryMovement = {
        id: `mov_init_${p.id}`,
        productId: p.id,
        warehouseId: 'wh_main',
        movementType: 'purchase',
        referenceId: 'PO-INIT-2026-001',
        quantity: inv.quantityOnHand,
        unitCost: p.costPrice,
        previousQty: 0,
        newQty: inv.quantityOnHand,
        notes: 'رصيد افتتاحي معتمد في مستودع البضائع الرئيسي',
        createdAt: new Date().toISOString(),
        createdBy: 'طارق العتيبي (أمين المخزون)',
      };
      await setDoc(doc(db, 'inventory_movements', movement.id), movement);
    }
    counts['inventory'] = products.length;
    counts['inventory_movements'] = products.length;

    // 11. طرق الدفع Payment Methods
    const paymentMethods: PaymentMethod[] = [
      { id: 'pm_cash', code: 'CASH', nameAr: 'نقدي (كاش)', nameEn: 'Cash', requiresReference: false, isActive: true },
      { id: 'pm_mada', code: 'MADA', nameAr: 'شبكة مدى الإلكترونية', nameEn: 'Mada Debit', requiresReference: true, isActive: true },
      { id: 'pm_visa', code: 'CARD', nameAr: 'بطاقة ائتمانية (Visa / Master)', nameEn: 'Credit Card', requiresReference: true, isActive: true },
      { id: 'pm_credit', code: 'CREDIT', nameAr: 'حساب آجل (مقاولين وشركات)', nameEn: 'Contractor Credit', requiresReference: true, isActive: true },
      { id: 'pm_bank', code: 'TRANSFER', nameAr: 'تحويل بنكي مباشر', nameEn: 'Bank Transfer', requiresReference: true, isActive: true },
    ];
    for (const pm of paymentMethods) {
      await setDoc(doc(db, 'payment_methods', pm.id), pm);
    }
    counts['payment_methods'] = paymentMethods.length;

    // 12. الإعدادات الضريبية Tax Settings
    const taxSetting: TaxSetting = {
      id: 'tax_vat_15',
      nameAr: 'ضريبة القيمة المضافة القياسية (15%)',
      ratePercent: 15.0,
      taxNumber: '310948572100003',
      isDefault: true,
      isActive: true,
    };
    await setDoc(doc(db, 'tax_settings', taxSetting.id), taxSetting);
    counts['tax_settings'] = 1;

    // 13. إعدادات النظام System Settings
    const systemSettings: SystemSetting[] = [
      { id: 'set_company_name', key: 'COMPANY_NAME_AR', value: 'مؤسسة عماد سعد آل سعيد لمواد البناء (عمادكو)', category: 'company', description: 'الاسم التجاري المعتمد بالفاتورة', updatedAt: new Date().toISOString() },
      { id: 'set_cr_number', key: 'CR_NUMBER', value: '1010998877', category: 'company', description: 'السجل التجاري', updatedAt: new Date().toISOString() },
      { id: 'set_zatca_phase', key: 'ZATCA_INTEGRATION_PHASE', value: 'PHASE_2_COMPLIANT', category: 'vat', description: 'مستوى الربط مع هيئة الزكاة والضريبة والجمارك', updatedAt: new Date().toISOString() },
      { id: 'set_receipt_footer', key: 'RECEIPT_FOOTER_NOTE', value: 'البضاعة المباعة ترد وتستبدل خلال 7 أيام بحالتها الأصلية مع الفاتورة. شكراً لتعاملكم مع عمادكو.', category: 'printing', description: 'تذييل الفاتورة الحرارية', updatedAt: new Date().toISOString() },
      { id: 'set_currency', key: 'CURRENCY_SYMBOL', value: 'ر.س', category: 'company', description: 'العملة الأساسية للنظام', updatedAt: new Date().toISOString() },
    ];
    for (const ss of systemSettings) {
      await setDoc(doc(db, 'system_settings', ss.id), ss);
    }
    counts['system_settings'] = systemSettings.length;

    // 14. فاتورة بيع وعملية بيع نموذجية واقعية للتحقق من تكامل POS & Invoices
    const sampleSale: Sale = {
      id: 'sale_demo_001',
      saleNumber: 'POS-2026-0001',
      customerId: 'cust_al_abraj',
      customerName: 'شركة الأبراج للمقاولات العامة والإنشاءات',
      branchId: 'branch_main',
      warehouseId: 'wh_main',
      cashierId: 'user_cashier',
      saleType: 'pos_cash',
      status: 'completed',
      subtotal: 540.0,
      taxTotal: 81.0,
      discountTotal: 0,
      grandTotal: 621.0,
      paidAmount: 621.0,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'sales', sampleSale.id), sampleSale);
    counts['sales'] = 1;

    const sampleSaleItem: SaleItem = {
      id: 'sitem_demo_001',
      saleId: sampleSale.id,
      productId: 'prod_kalon_ahram',
      productName: 'كالون باب أهرام كمبيوتر أصلي 70 ملم سلندر نحاس',
      quantity: 4,
      unitPrice: 95.0,
      discount: 0,
      taxRate: 15,
      lineTotal: 380.0,
    };
    await setDoc(doc(db, 'sale_items', sampleSaleItem.id), sampleSaleItem);
    counts['sale_items'] = 1;

    const sampleInvoice: Invoice = {
      id: 'inv_demo_001',
      invoiceNumber: 'INV-2026-0001',
      saleId: sampleSale.id,
      invoiceType: 'simplified_tax_invoice',
      issueDate: new Date().toISOString(),
      customerName: 'شركة الأبراج للمقاولات العامة والإنشاءات',
      customerTaxNumber: '300984729100003',
      totalExcludingTax: 540.0,
      taxAmount: 81.0,
      totalIncludingTax: 621.0,
      paymentStatus: 'paid',
      zatcaUuid: 'c7b56e48-8123-41a9-b4b1-9c6a1b2c3d4e',
    };
    await setDoc(doc(db, 'invoices', sampleInvoice.id), sampleInvoice);
    counts['invoices'] = 1;

    const sampleEInvoice: ElectronicInvoice = {
      id: 'einv_demo_001',
      invoiceId: sampleInvoice.id,
      uuid: sampleInvoice.zatcaUuid || 'c7b56e48-8123-41a9-b4b1-9c6a1b2c3d4e',
      invoiceNumber: sampleInvoice.invoiceNumber,
      issueDate: sampleInvoice.issueDate,
      invoiceType: 'simplified',
      subtotal: sampleInvoice.totalExcludingTax,
      vat: sampleInvoice.taxAmount,
      total: sampleInvoice.totalIncludingTax,
      qrData: 'AQ5idW55YW4gRVJQIFAwUwIPMzEwOTQ4NTcyMTAwMDAzAxQyMDI2LTA5LTEzVDAwOjE1OjAwWgQGNjIxLjAwBQE4MS4wMA==',
      invoiceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      previousInvoiceHash: '0000000000000000000000000000000000000000000000000000000000000000',
      submissionStatus: 'Accepted',
      validationStatus: 'Valid',
      timestamp: new Date().toISOString(),
      qrCodeData: 'AQ5idW55YW4gRVJQIFAwUwIPMzEwOTQ4NTcyMTAwMDAzAxQyMDI2LTA5LTEzVDAwOjE1OjAwWgQGNjIxLjAwBQE4MS4wMA==',
      cryptographicStamp: 'MEQCID6v+9n8X+4k/7Qv1h2m...ZATCA-SECURE',
      zatcaStatus: 'cleared',
      complianceTimestamp: new Date().toISOString(),
    };
    await setDoc(doc(db, 'electronic_invoices', sampleEInvoice.id), sampleEInvoice);
    counts['electronic_invoices'] = 1;

    // تسجيل العملية في Audit Log
    await logAuditEvent({
      userId: 'user_owner',
      userName: 'م. عبد الله الهاشمي (الدعم الفني Admin)',
      action: 'SEED_DATABASE',
      entity: 'database',
      entityId: 'full_system',
      details: 'تمت تهيئة وبذر قاعدة البيانات الأولية بنجاح بكافة الكالونات والأقفال والمفصلات ومواد المقاولين',
    });
    counts['audit_logs'] = 1;

    return {
      success: true,
      counts,
      message: 'تم غرس وبذر بيانات مواد البناء والأدوار والمستخدمين في قاعدة البيانات بنجاح!',
    };
  } catch (error: any) {
    console.error('خطأ أثناء غرس البيانات في Firestore:', error);
    return {
      success: false,
      counts,
      message: `فشل غرس البيانات: ${error?.message || 'خطأ غير معروف'}`,
    };
  }
}

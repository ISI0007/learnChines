import os, zipfile, shutil

TG = os.path.expandvars(r'%USERPROFILE%\Downloads\Telegram Desktop')
HSK = r'D:\HSK'
OUT = r'D:\HSK-USB-Bundle'
os.makedirs(OUT, exist_ok=True)

# (level, [(source_path, dest_path_in_zip), ...])
PLAN = {
    'HSK1': [
        (os.path.join(HSK, 'HSK 1', 'Books'), 'HSK 1/Books'),
        (os.path.join(HSK, 'HSK 1', 'Papers'), 'HSK 1/Papers'),
        (os.path.join(HSK, 'HSK 1', 'Answers'), 'HSK 1/Answers'),
        (os.path.join(HSK, 'HSK 1', 'Audio'), 'HSK 1/Audio'),
        (os.path.join(TG, '新HSK教程1+配套音频.rar'), 'HSK 1/Books/HSK 1 - 3.0 Book + Audio.rar'),
    ],
    'HSK2': [
        (os.path.join(HSK, 'HSK 2', 'Books'), 'HSK 2/Books'),
        (os.path.join(HSK, 'HSK 2', 'Papers'), 'HSK 2/Papers'),
        (os.path.join(HSK, 'HSK 2', 'Answers'), 'HSK 2/Answers'),
        (os.path.join(HSK, 'HSK 2', 'Audio'), 'HSK 2/Audio'),
        (os.path.join(TG, '新HSK2 教材 @hanyu_uz.pdf'), 'HSK 2/Books/HSK 2 - 3.0 Book.pdf'),
    ],
    'HSK3': [
        (os.path.join(HSK, 'HSK 3', 'Books'), 'HSK 3/Books'),
        (os.path.join(HSK, 'HSK 3', 'Papers'), 'HSK 3/Papers'),
        (os.path.join(HSK, 'HSK 3', 'Answers'), 'HSK 3/Answers'),
        (os.path.join(HSK, 'HSK 3', 'Audio'), 'HSK 3/Audio'),
        (os.path.join(TG, '新HSK3教材 @hanyu_uz.pdf'), 'HSK 3/Books/HSK 3 - 3.0 Book.pdf'),
    ],
    'HSK4': [
        (os.path.join(HSK, 'HSK 4', 'Papers'), 'HSK 4/Papers'),
        (os.path.join(HSK, 'HSK 4', 'Answers'), 'HSK 4/Answers'),
        (os.path.join(HSK, 'HSK 4', 'Audio'), 'HSK 4/Audio'),
        (os.path.join(TG, '新HSK教程4上 @hanyu_uz.pdf'), 'HSK 4/Books/HSK 4a - 3.0 Book.pdf'),
        (os.path.join(TG, '新 HSK 4下 @hanyu_uz.pdf'), 'HSK 4/Books/HSK 4b - 3.0 Book.pdf'),
        (os.path.join(TG, 'New HSK 4上 audio @hanyu_uz.zip'), 'HSK 4/Audio/HSK 4a audio.zip'),
    ],
    'HSK5': [
        (os.path.join(HSK, 'HSK 5', 'Papers'), 'HSK 5/Papers'),
        (os.path.join(HSK, 'HSK 5', 'Answers'), 'HSK 5/Answers'),
        (os.path.join(HSK, 'HSK 5', 'Audio'), 'HSK 5/Audio'),
    ],
    'Reference': [
        (os.path.join(HSK, 'Reference'), 'Reference'),
    ],
}

def add_tree(zf, src, dest):
    if os.path.isfile(src):
        zf.write(src, dest)
        return 1
    n = 0
    for root, _, files in os.walk(src):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, src)
            zf.write(fp, os.path.join(dest, rel))
            n += 1
    return n

for name, items in PLAN.items():
    zp = os.path.join(OUT, name + '.zip')
    if os.path.exists(zp):
        os.remove(zp)
    n = 0
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
        for src, dest in items:
            if not os.path.exists(src):
                print('  MISSING:', src)
                continue
            n += add_tree(zf, src, dest)
    mb = os.path.getsize(zp) / 1024 / 1024
    print('%-10s %4d files  %8.1f MB  -> %s' % (name, n, mb, zp))
print('DONE')

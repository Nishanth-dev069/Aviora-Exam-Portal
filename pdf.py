#!/usr/bin/env python3
"""
ZYXEN Aviation Assessment & Learning Platform
Premium Institutional Capability Brochure — 11 Pages
"""

import os, math
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as Canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm

W, H  = A4
LOGO  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Zyxen-logo.jpeg") if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "Zyxen-logo.jpeg")) else "/mnt/user-data/uploads/Zyxen-logo.jpeg"
OUT   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ZYXEN_Capability_Brochure.pdf")

LM = 40; RM = W - 40; CW = W - 80

# ── Palette ─────────────────────────────────────────────────────────────
DEEP  = HexColor('#07101F')
NAVY  = HexColor('#0C1C3E')
MID   = HexColor('#10275A')
STEEL = HexColor('#1C3B74')
GOLD  = HexColor('#C9A84C')
GLDL  = HexColor('#DEC97A')
WH    = HexColor('#FFFFFF')
OFF   = HexColor('#F4F7FB')
LG    = HexColor('#E1E7EF')
MG    = HexColor('#8A96A8')
DG    = HexColor('#47566B')
TX    = HexColor('#1B2538')
LBLU  = HexColor('#2E6FD4')
DKDV  = HexColor('#18273F')   # dark divider

RG = 'Helvetica'; BD = 'Helvetica-Bold'; IT = 'Helvetica-Oblique'

# ── Helpers ──────────────────────────────────────────────────────────────

def fill(c, col, x=0, y=0, w=None, h=None):
    c.setFillColor(col)
    c.rect(x, y, W if w is None else w, H if h is None else h, fill=1, stroke=0)

def box(c, x, y, w, h, fc=None, sc=None, lw=0.5, r=0):
    if fc: c.setFillColor(fc)
    if sc: c.setStrokeColor(sc); c.setLineWidth(lw)
    f = 1 if fc else 0; s = 1 if sc else 0
    if r: c.roundRect(x, y, w, h, r, fill=f, stroke=s)
    else: c.rect(x, y, w, h, fill=f, stroke=s)

def T(c, s, x, y, f=RG, sz=10, col=WH, a='L'):
    c.setFont(f, sz); c.setFillColor(col)
    {'L': c.drawString, 'C': c.drawCentredString, 'R': c.drawRightString}[a](x, y, s)

def L(c, x1, y1, x2, y2, col=WH, lw=1):
    c.setStrokeColor(col); c.setLineWidth(lw); c.line(x1, y1, x2, y2)

def wrap(c, text, x, y, mw, f=RG, sz=9.5, col=WH, ld=None, a='L'):
    if ld is None: ld = sz * 1.62
    words = text.split(); lines, cur = [], []
    c.setFont(f, sz)
    for w_ in words:
        test = ' '.join(cur + [w_])
        if c.stringWidth(test, f, sz) <= mw: cur.append(w_)
        else:
            if cur: lines.append(' '.join(cur))
            cur = [w_]
    if cur: lines.append(' '.join(cur))
    for i, ln in enumerate(lines):
        T(c, ln, x, y - i*ld, f, sz, col, a)
    return y - len(lines)*ld

def logo_img(c, x, y, sz=38):
    if os.path.exists(LOGO):
        c.drawImage(LOGO, x, y, width=sz, height=sz, preserveAspectRatio=True)

def gold_bar(c, h=3):
    fill(c, GOLD, 0, H-h, W, h)

def arr_r(c, x, y, ln, col=GOLD, lw=1.5, hs=5):
    c.setStrokeColor(col); c.setFillColor(col); c.setLineWidth(lw)
    c.line(x, y, x+ln-hs, y)
    p = c.beginPath(); p.moveTo(x+ln-hs, y+hs/2); p.lineTo(x+ln, y); p.lineTo(x+ln-hs, y-hs/2)
    p.close(); c.drawPath(p, fill=1, stroke=0)

def arr_d(c, x, y, ln, col=GOLD, lw=1.5, hs=5):
    c.setStrokeColor(col); c.setFillColor(col); c.setLineWidth(lw)
    c.line(x, y, x, y-ln+hs)
    p = c.beginPath(); p.moveTo(x-hs/2, y-ln+hs); p.lineTo(x, y-ln); p.lineTo(x+hs/2, y-ln+hs)
    p.close(); c.drawPath(p, fill=1, stroke=0)

def diag_deco(c, bx, by, bw, bh, col, lw=1.2, sp=30):
    c.saveState()
    p = c.beginPath(); p.rect(bx, by, bw, bh); c.clipPath(p, stroke=0)
    c.setStrokeColor(col); c.setLineWidth(lw)
    n = int((bw + bh) / sp) + 3
    for i in range(n):
        c.line(bx + i*sp, by+bh, bx + i*sp - bh, by)
    c.restoreState()

def footer(c, pg, dark=True):
    tc = HexColor('#4A5A72') if dark else MG
    lc = DKDV if dark else LG
    L(c, LM, 30, RM, 30, lc, 0.4)
    T(c, 'zyxen.in', LM, 17, RG, 7, tc)
    T(c, 'ZYXEN  ·  Aviation Assessment & Learning Platform', W/2, 17, RG, 7, tc, 'C')
    T(c, str(pg), RM, 17, RG, 7, tc, 'R')

def mini_logo(c, dark=True):
    sz = 22; lx = LM; ly = H - 14 - sz
    if not dark:
        box(c, lx-2, ly-2, sz+4, sz+4, fc=NAVY)
    logo_img(c, lx, ly, sz)
    T(c, 'ZYXEN', lx+sz+8, ly+sz/2-4, BD, 11, WH if dark else TX)
    T(c, 'zyxen.in', RM, ly+sz/2-4, RG, 8, MG, 'R')

def sec_label(c, label, x, y):
    L(c, x, y, x+40, y, GOLD, 2)
    T(c, label, x+50, y-4, BD, 7.5, GOLD)


# ════════════════════════════════════════════════════════════════════════
# PAGE 01 — COVER
# ════════════════════════════════════════════════════════════════════════

def p01(c):
    fill(c, DEEP)
    gold_bar(c, 3)

    # Diagonal texture — right half
    diag_deco(c, W*0.46, 0, W*0.54, H, HexColor('#0F1F3A'), 1.5, 32)

    # Large Z-chevron shapes (decorative, subtle)
    c.saveState(); c.setStrokeColor(HexColor('#0C1D38')); c.setLineWidth(7)
    c.line(W*0.60, H*0.84, W*0.92, H*0.84)
    c.line(W*0.92, H*0.84, W*0.60, H*0.66)
    c.line(W*0.60, H*0.66, W*0.92, H*0.66)
    c.setLineWidth(5)
    c.line(W*0.64, H*0.56, W*0.89, H*0.56)
    c.line(W*0.89, H*0.56, W*0.64, H*0.42)
    c.line(W*0.64, H*0.42, W*0.89, H*0.42)
    c.restoreState()

    # Logo + wordmark
    lsz = 44
    logo_img(c, LM, H-18-lsz, lsz)
    T(c, 'ZYXEN', LM+lsz+10, H-18-lsz*0.42, BD, 22, WH)
    T(c, 'zyxen.in', RM, H-18-lsz*0.42, RG, 9, MG, 'R')

    # Main content block
    cy = H*0.655
    L(c, LM, cy, LM+55, cy, GOLD, 2.5)
    T(c, 'AVIATION ASSESSMENT & LEARNING PLATFORM', LM+65, cy-4.5, BD, 7.5, GOLD)

    cy -= 30
    T(c, 'Prepare Better.', LM, cy, BD, 40, WH)
    T(c, 'Assess Smarter.', LM, cy-50, BD, 40, WH)

    cy -= 118
    T(c, 'Purpose-built digital assessment and learning technology', LM, cy, RG, 10.5, MG)
    T(c, 'for aviation training institutions across India.', LM, cy-16, RG, 10.5, MG)

    cy -= 52
    L(c, LM, cy, LM+180, cy, HexColor('#1A2E50'), 0.5)
    cy -= 22
    T(c, 'Covering every stage of the assessment lifecycle — from question creation', LM, cy, IT, 9, HexColor('#5A6E88'))
    T(c, 'and examination delivery through performance intelligence and student learning.', LM, cy-14, IT, 9, HexColor('#5A6E88'))

    # Category tags
    tags = ['DGCA-Style Assessment', 'Performance Analytics', 'Student Learning', 'Instructor Intelligence']
    ty2 = 98; tx2 = LM
    for tag in tags:
        c.setFont(RG, 7.5); tw = c.stringWidth(tag, RG, 7.5) + 22; th = 21
        box(c, tx2, ty2-th/2, tw, th, fc=MID, r=3)
        c.setStrokeColor(STEEL); c.setLineWidth(0.5)
        c.roundRect(tx2, ty2-th/2, tw, th, 3, fill=0, stroke=1)
        T(c, tag, tx2+11, ty2-4.5, RG, 7.5, HexColor('#8AAAD4'))
        tx2 += tw + 10

    footer(c, 1)


# ════════════════════════════════════════════════════════════════════════
# PAGE 02 — THE BIG IDEA
# ════════════════════════════════════════════════════════════════════════

def p02(c):
    fill(c, NAVY)
    gold_bar(c, 3)
    mini_logo(c, dark=True)

    LCW = CW*0.53; RCX = LM + LCW + 36; RCW = RM - RCX

    y = H - 70
    sec_label(c, 'THE CORE CONCEPT', LM, y)

    y -= 30
    T(c, 'What if your cadets', LM, y, BD, 27, WH)
    T(c, 'had already taken the', LM, y-34, BD, 27, WH)
    T(c, 'DGCA exam — before', LM, y-68, BD, 27, WH)
    T(c, 'the actual exam?', LM, y-102, BD, 27, WH)

    y -= 148
    L(c, LM, y, LM+LCW-12, y, HexColor('#1A2D55'), 0.5)
    y -= 22
    b1 = ("Examination day should measure knowledge — not familiarity with unfamiliar software. "
          "Students encountering a new examination interface for the first time during a live "
          "assessment must simultaneously navigate an unknown environment, manage a countdown, "
          "and answer difficult questions under pressure.")
    y = wrap(c, b1, LM, y, LCW-12, RG, 9.5, HexColor('#7A8FA8'), 16) - 18

    b2 = ("Repeated exposure to a realistic examination environment builds familiarity. "
          "Familiarity reduces cognitive friction. ZYXEN allows cadets to practice in an "
          "assessment environment designed to closely resemble the structure and operational "
          "flow of DGCA-style computer-based examinations.")
    y = wrap(c, b2, LM, y, LCW-12, RG, 9.5, HexColor('#7A8FA8'), 16) - 24

    # Pull-quote
    box(c, LM, y-56, LCW-12, 56, fc=MID, r=3)
    box(c, LM, y-56, 3, 56, fc=GOLD)
    T(c, '"The student should be thinking about the question —', LM+14, y-16, IT, 9.5, GLDL)
    T(c, 'not figuring out the examination interface."', LM+14, y-30, IT, 9.5, GLDL)
    L(c, LM+14, y-40, LM+LCW-26, y-40, HexColor('#1E3868'), 0.4)
    T(c, 'Central design principle, ZYXEN Assessment Platform', LM+14, y-52, RG, 7.5, MG)

    # ── Right column: Familiarity Flow ──────────────────
    steps = [
        ('FIRST EXPOSURE',  'Initial encounter with the examination environment'),
        ('PRACTICE',        'Repeated assessments across all examination subjects'),
        ('FAMILIARITY',     'The interface becomes instinctive, not unfamiliar'),
        ('CONFIDENCE',      'Full cognitive focus shifts to answering the question'),
        ('READINESS',       'The cadet is prepared — not just for the content, but the experience'),
    ]
    fh = 48; fg = 14; fy = H - 82

    for i, (title, sub) in enumerate(steps):
        iy = fy - i*(fh+fg)
        acc = GOLD if i == 0 else (LBLU if i == 1 else HexColor('#1B3A74'))
        bg_c = STEEL if i == 0 else MID

        box(c, RCX, iy-fh, RCW, fh, fc=bg_c, r=3)
        box(c, RCX, iy-fh, 4, fh, fc=acc)

        T(c, f'0{i+1}', RCX+12, iy-fh/2-4, BD, 9, GOLD if i==0 else HexColor('#2A4880'))
        T(c, title, RCX+28, iy-fh*0.35, BD, 9.5, WH)
        wrap(c, sub, RCX+28, iy-fh*0.35-13, RCW-36, RG, 7.5,
             HexColor('#B8CCF0') if i==0 else MG, 12)

        if i < len(steps)-1:
            arr_d(c, RCX+RCW/2, iy-fh-1, fg-2,
                  GOLD if i==0 else HexColor('#1A3060'), 1.2, 5)

    T(c, 'The ZYXEN Familiarity Framework', RCX+RCW/2,
      fy - len(steps)*(fh+fg) - 14, IT, 8, MG, 'C')

    footer(c, 2)


# ════════════════════════════════════════════════════════════════════════
# PAGE 03 — CBT ASSESSMENT PLATFORM
# ════════════════════════════════════════════════════════════════════════

def p03(c):
    fill(c, OFF); gold_bar(c, 3)
    fill(c, NAVY, 0, 0, 8, H)
    mini_logo(c, dark=False)

    # Watermark
    c.saveState(); c.setFont(BD, 130); c.setFillColor(LG)
    c.drawRightString(RM+12, H*0.33, '03'); c.restoreState()

    y = H - 70
    sec_label(c, 'CBT ASSESSMENT PLATFORM', LM+20, y)

    y -= 30
    T(c, 'An Examination Experience', LM+20, y, BD, 24, TX)
    T(c, 'Designed Around Aviation.', LM+20, y-30, BD, 24, TX)

    y -= 68
    b = ("ZYXEN is not a generic quiz platform adapted for aviation. It is purpose-built "
         "from the ground up for the assessment and examination preparation requirements "
         "of aviation training institutions, flight academies and ground schools preparing "
         "cadets for DGCA-style computer-based examinations.")
    y = wrap(c, b, LM+20, y, CW-20, RG, 9.5, DG, 16) - 14

    b2 = ("Every element — from the examination interface to the question structure, timing "
          "mechanics and result delivery — is designed around how aviation examinations "
          "actually work, not around how a generic assessment product works.")
    y = wrap(c, b2, LM+20, y, CW-20, RG, 9.5, DG, 16)

    # ── 5 Pillars: 3 top + 2 bottom ─────────────────────
    gap = 10; ph = 128
    r1w = (RM - LM - 20 - gap*2) / 3
    r2w = (RM - LM - 20 - gap) / 2
    py1 = y - 28; py2 = py1 - ph - 16

    pillars = [
        ('REALISTIC EXAMINATION', 'EXPERIENCE',
         ['A structured CBT environment designed to closely replicate',
          'DGCA-style examination flow — including navigation, timer,',
          'question palette, review mechanics and structured answering.'], GOLD),
        ('FLEXIBLE', 'ASSESSMENT',
         ['Create subject-specific examinations, timed mock tests,',
          'practice sessions and scheduled assessments for any',
          'batch of cadets — at any stage of their training cycle.'], LBLU),
        ('INSTRUCTOR', 'CONTROL',
         ['Faculty maintain full control over question banks, exam',
          'creation, batch management, scheduling and the delivery',
          'of assessments across subjects and student cohorts.'], HexColor('#28A86C')),
        ('STUDENT PERFORMANCE', 'INTELLIGENCE',
         ['Turn examination results into structured academic insight.',
          'Subject, topic and question-level analysis makes every',
          'assessment an opportunity to understand the student better.'], HexColor('#E07828')),
        ('ASSESSMENT', 'INTEGRITY',
         ['Built-in examination controls support supervised, structured',
          'assessments with appropriate monitoring, access controls',
          'and session management for serious examination conduct.'], HexColor('#9B59B6')),
    ]

    for i, (t1, t2, body_lines, acc) in enumerate(pillars):
        if i < 3:
            px = LM+20 + i*(r1w+gap); py = py1; pw = r1w
        else:
            px = LM+20 + (i-3)*(r2w+gap); py = py2; pw = r2w

        box(c, px, py-ph, pw, ph, fc=WH, sc=LG, lw=0.5, r=3)
        box(c, px, py-ph, 4, ph, fc=acc)

        T(c, t1, px+14, py-16, BD, 9, TX)
        T(c, t2, px+14, py-28, BD, 9, TX)
        L(c, px+14, py-36, px+pw-10, py-36, LG, 0.4)
        for k, bl in enumerate(body_lines):
            T(c, bl, px+14, py-50-k*13, RG, 7.5, DG)

    # ── Subjects covered ─────────────────────────────────
    sy = py2 - ph - 22
    L(c, LM+20, sy+18, RM, sy+18, LG, 0.4)
    T(c, 'SUBJECTS COVERED', LM+20, sy+4, BD, 7.5, MG)
    subjects = ['Air Navigation', 'Aviation Meteorology', 'Air Regulations',
                'Technical General', 'Technical Specific', 'RTR(A)']
    sx = LM + 148
    for s in subjects:
        c.setFont(RG, 7.5); sw = c.stringWidth(s, RG, 7.5) + 18
        box(c, sx, sy-3, sw, 16, fc=LG, r=2)
        T(c, s, sx+9, sy+3, RG, 7.5, DG); sx += sw + 8

    footer(c, 3, dark=False)


# ════════════════════════════════════════════════════════════════════════
# PAGE 04 — THE EXAMINATION EXPERIENCE
# ════════════════════════════════════════════════════════════════════════

def p04(c):
    fill(c, DEEP); gold_bar(c, 3)
    diag_deco(c, W*0.50, 0, W*0.50, H, HexColor('#0D1B34'), 1, 35)
    mini_logo(c, dark=True)

    LCW = CW*0.43; RCX = LM + LCW + 26; RCW = RM - RCX

    y = H - 70
    sec_label(c, 'EXAMINATION EXPERIENCE', LM, y)
    y -= 30
    T(c, 'Make the Environment', LM, y, BD, 23, WH)
    T(c, 'Familiar Before', LM, y-29, BD, 23, WH)
    T(c, 'the Stakes Are Real.', LM, y-58, BD, 23, WH)
    y -= 98

    b = ("Every element of the ZYXEN examination environment is designed to feel "
         "familiar before a cadet faces a real assessment. When the examination begins, "
         "they should already know exactly where to find the timer, how to navigate "
         "between questions, and how to mark items for review.")
    y = wrap(c, b, LM, y, LCW, RG, 9.5, HexColor('#7A8FA8'), 16) - 28

    # Journey steps
    journey = ['Login & Authentication', 'Examination Instructions', 'Question Navigation',
               'Answering & Response Control', 'Mark for Review', 'Submission', 'Instant Results']
    jh = 30; jg = 7
    for i, step in enumerate(journey):
        jy = y - i*(jh+jg)
        active = i <= 4
        box(c, LM, jy-jh, LCW, jh, fc=STEEL if active else MID, r=2)
        box(c, LM, jy-jh, 3, jh, fc=GOLD if active else HexColor('#1A2D58'))
        T(c, f'{i+1:02d}', LM+10, jy-jh/2-4, BD, 8,
          GOLD if active else HexColor('#2A4060'))
        T(c, step, LM+26, jy-jh/2+3, BD, 9,
          WH if active else HexColor('#4A6090'))
        if i < len(journey)-1:
            arr_d(c, LM+LCW/2, jy-jh-1, jg-1,
                  GOLD if active else HexColor('#1A2D58'), 1, 4)

    # ── Right: Vector UI Mockup ───────────────────────────
    mx = RCX; mw = RCW; my_top = H - 52

    # Outer frame
    box(c, mx, my_top-428, mw, 428, fc=HexColor('#08142A'), r=4)
    box(c, mx, my_top-428, mw, 428, sc=HexColor('#1A3060'), lw=1, r=4)

    # Top chrome bar
    bh = 34
    box(c, mx, my_top-bh, mw, bh, fc=HexColor('#040B18'))
    L(c, mx, my_top-bh, mx+mw, my_top-bh, HexColor('#1A3060'), 0.5)
    # Dots (browser-style)
    for j, dc in enumerate([HexColor('#E05A4E'), HexColor('#E0A94E'), HexColor('#4EBE5C')]):
        c.setFillColor(dc); c.circle(mx+10+j*13, my_top-bh/2, 4, fill=1, stroke=0)
    T(c, 'ZYXEN Assessment Platform', mx+mw/2, my_top-bh/2-4, BD, 8.5,
      HexColor('#8AAAD4'), 'C')

    # Subject bar
    sb_h = 22; sb_y = my_top - bh - sb_h
    box(c, mx, sb_y, mw, sb_h, fc=HexColor('#060F20'))
    L(c, mx, sb_y+sb_h, mx+mw, sb_y+sb_h, HexColor('#1A3060'), 0.4)
    T(c, 'Air Navigation  —  Mock Examination 03', mx+10, sb_y+7, RG, 7.5, MG)
    T(c, '⏱  02:45:30', mx+mw-10, sb_y+7, BD, 8, GOLD, 'R')

    # Content area
    qa_w = mw - 70  # main question area; right 70 = palette
    qa_y = sb_y - 10

    T(c, 'Question 14 of 60', mx+10, qa_y-10, BD, 8.5, HexColor('#6A88C0'))
    T(c, '14 answered  ·  2 marked  ·  44 remaining', mx+10, qa_y-22, RG, 7, MG)
    L(c, mx+10, qa_y-27, mx+qa_w-6, qa_y-27, HexColor('#0E2040'), 0.4)

    T(c, 'Which of the following best describes the relationship between', mx+10, qa_y-42, BD, 8.5, WH)
    T(c, 'TAS and IAS as altitude increases in a standard atmosphere?', mx+10, qa_y-54, BD, 8.5, WH)

    opts = [
        ('A', 'TAS increases; IAS remains relatively constant at altitude', False),
        ('B', 'TAS increases with altitude; IAS decreases', True),
        ('C', 'Both TAS and IAS increase proportionally with altitude', False),
        ('D', 'TAS remains constant; IAS increases as altitude increases', False),
    ]
    opt_y = qa_y - 78; opt_h = 24; opt_g = 7
    for i, (ltr, txt_, sel) in enumerate(opts):
        oy = opt_y - i*(opt_h+opt_g)
        box(c, mx+10, oy-opt_h, qa_w-18, opt_h,
            fc=HexColor('#0F2A6A') if sel else HexColor('#0A1C3A'),
            sc=GOLD if sel else HexColor('#1A3060'), lw=1 if sel else 0.4, r=2)
        rc_x = mx+20; rc_y = oy - opt_h/2
        c.setStrokeColor(GOLD if sel else HexColor('#2A4880')); c.setLineWidth(1.2)
        c.circle(rc_x, rc_y, 4, fill=0, stroke=1)
        if sel:
            c.setFillColor(GOLD); c.circle(rc_x, rc_y, 2.3, fill=1, stroke=0)
        T(c, ltr+'.', mx+30, oy-opt_h/2-3.5, BD, 8,
          GOLD if sel else HexColor('#3A5A90'))
        T(c, txt_, mx+44, oy-opt_h/2-3.5, RG, 8,
          WH if sel else HexColor('#6A88B0'))

    # Nav bar
    nav_y = my_top - 428 + 6; nav_h = 28
    box(c, mx, nav_y, mw, nav_h, fc=HexColor('#040B18'))
    L(c, mx, nav_y+nav_h, mx+mw, nav_y+nav_h, HexColor('#1A3060'), 0.4)
    T(c, '← Previous', mx+10, nav_y+9, RG, 8, MG)
    T(c, 'Mark for Review', mx+mw/2, nav_y+9, RG, 8, HexColor('#E07828'), 'C')
    T(c, 'Next →', mx+mw-10, nav_y+9, BD, 8.5, GOLD, 'R')

    # Question palette sidebar
    pal_x = mx + qa_w; pal_w = 70
    T(c, 'QUESTIONS', pal_x+pal_w/2, qa_y-10, BD, 6.5, MG, 'C')
    L(c, pal_x, qa_y-15, pal_x+pal_w, qa_y-15, HexColor('#0E2040'), 0.4)

    sq = 11; sqg = 4; cols = 4
    answered = {1,2,3,4,5,7,8,10,12,13,15}; marked = {6, 11}
    for i in range(20):
        qn = i+1; col2 = i % cols; row = i // cols
        qx2 = pal_x + 5 + col2*(sq+sqg); qy2 = qa_y - 24 - row*(sq+sqg)
        if qn == 14:       fc2 = GOLD
        elif qn in marked: fc2 = HexColor('#9B59B6')
        elif qn in answered: fc2 = HexColor('#1E5A3A')
        else: fc2 = HexColor('#0A1C3A')
        box(c, qx2, qy2-sq, sq, sq, fc=fc2, r=1)
        T(c, str(qn), qx2+sq/2, qy2-sq+2.5, RG, 5.5, WH, 'C')

    lg_y = qa_y - 24 - 5*(sq+sqg) - 10
    legend = [(GOLD,'Current'),(HexColor('#1E5A3A'),'Answered'),
              (HexColor('#9B59B6'),'Marked'),(HexColor('#0A1C3A'),'Remaining')]
    for lc2, lt in legend:
        lg_y -= 15
        box(c, pal_x+5, lg_y-7, 9, 9, fc=lc2, r=1)
        T(c, lt, pal_x+18, lg_y-6, RG, 6, MG)

    footer(c, 4)


# ════════════════════════════════════════════════════════════════════════
# PAGE 05 — PERFORMANCE INTELLIGENCE
# ════════════════════════════════════════════════════════════════════════

def p05(c):
    fill(c, WH); gold_bar(c, 3)
    fill(c, NAVY, 0, 0, 8, H)
    mini_logo(c, dark=False)

    c.saveState(); c.setFont(BD, 130); c.setFillColor(LG)
    c.drawRightString(RM+12, H*0.33, '05'); c.restoreState()

    y = H - 70
    sec_label(c, 'PERFORMANCE INTELLIGENCE', LM+20, y)
    y -= 30
    T(c, 'More Than a Score.', LM+20, y, BD, 26, TX)

    y -= 52
    b = ("Every ZYXEN assessment generates structured performance data — not just a final mark. "
         "Instructors can move beyond asking whether a student passed and begin asking "
         "where that student needs the most support.")
    y = wrap(c, b, LM+20, y, CW*0.46, RG, 9.5, DG, 16) - 20

    # Pull quote
    box(c, LM+20, y-54, CW*0.46-10, 54, fc=HexColor('#F0F4FA'), r=3)
    box(c, LM+20, y-54, 3, 54, fc=LBLU)
    T(c, '"Instead of asking only Did the student pass? —', LM+32, y-16, IT, 9.5, STEEL)
    T(c, 'instructors can begin asking Where does this', LM+32, y-30, IT, 9.5, STEEL)
    T(c, 'student need help?"', LM+32, y-44, IT, 9.5, STEEL)

    y -= 74
    # Two-col capability list
    caps_l = [
        ('Subject-Wise Performance',  'Understand results at subject level across all assessments'),
        ('Topic-Level Insights',      'Drill into specific topic performance within each subject'),
        ('Individual Progress',       'Track each student\'s improvement and trajectory over time'),
        ('Post-Exam Feedback',        'Detailed explanations and solutions delivered after each test'),
    ]
    caps_r = [
        ('Batch Comparison',          'Compare cohort results and rank performance across batches'),
        ('Weakness Identification',   'Surface areas requiring focused revision and practice'),
        ('Examination Readiness',     'Monitor readiness across a batch ahead of real assessments'),
        ('Solution Explanations',     'Step-by-step answer walkthroughs for every question'),
    ]

    for i, (title, sub) in enumerate(caps_l):
        iy2 = y - i*42
        c.setFillColor(GOLD); c.circle(LM+26, iy2-5, 4, fill=1, stroke=0)
        T(c, title, LM+38, iy2-1, BD, 9, TX)
        T(c, sub, LM+38, iy2-14, RG, 8, DG)

    for i, (title, sub) in enumerate(caps_r):
        iy2 = y - i*42
        c.setFillColor(LBLU); c.circle(LM+CW/2+18, iy2-5, 4, fill=1, stroke=0)
        T(c, title, LM+CW/2+30, iy2-1, BD, 9, TX)
        T(c, sub, LM+CW/2+30, iy2-14, RG, 8, DG)

    # ── Right: Cascade Diagram ────────────────────────────
    rx = LM + CW*0.52; rw = RM - rx; cy3 = H - 70

    cascade = [
        ('EXAMINATION RESULT',    GOLD,                 True),
        ('SUBJECT PERFORMANCE',   LBLU,                 False),
        ('TOPIC INSIGHT',         HexColor('#28A86C'),  False),
        ('WEAKNESS IDENTIFIED',   HexColor('#E07828'),  False),
        ('TARGETED PRACTICE',     HexColor('#9B59B6'),  False),
        ('REASSESSMENT',          GOLD,                 False),
    ]
    ch = 40; cg = 12

    for i, (label, acc, first) in enumerate(cascade):
        ciy = cy3 - i*(ch+cg)
        box(c, rx, ciy-ch, rw, ch,
            fc=HexColor('#F8FAFF') if first else WH,
            sc=GOLD if first else LG, lw=1.5 if first else 0.5, r=3)
        box(c, rx, ciy-ch, 4, ch, fc=acc)
        T(c, label, rx+14, ciy-ch/2-3.5, BD, 9, TX)
        if first:
            T(c, 'Input', rx+rw-10, ciy-ch/2-3.5, RG, 7.5, MG, 'R')
        if i < len(cascade)-1:
            arr_d(c, rx+rw/2, ciy-ch-1, cg-2, acc, 1.3, 5)

    T(c, 'Assessment → Intelligence Cascade', rx+rw/2,
      cy3 - len(cascade)*(ch+cg) - 14, IT, 8, MG, 'C')

    footer(c, 5, dark=False)


# ════════════════════════════════════════════════════════════════════════
# PAGE 06 — STUDENT LEARNING ECOSYSTEM
# ════════════════════════════════════════════════════════════════════════

def p06(c):
    fill(c, OFF); gold_bar(c, 3)
    fill(c, NAVY, 0, 0, 8, H)
    mini_logo(c, dark=False)

    y = H - 70
    sec_label(c, 'STUDENT LEARNING ECOSYSTEM', LM+20, y)
    y -= 30
    T(c, 'From Assessment to', LM+20, y, BD, 24, TX)
    T(c, 'Continuous Learning.', LM+20, y-30, BD, 24, TX)

    y -= 70
    b = ("ZYXEN extends beyond examination delivery. The learning ecosystem connects "
         "assessment outcomes directly to structured learning activity — creating a "
         "natural loop of assessment, review, practice, improvement and reassessment.")
    y = wrap(c, b, LM+20, y, CW-20, RG, 9.5, DG, 16) - 28

    # ── Cycle Flow Diagram ───────────────────────────────
    cycle_items = ['ASSESS', 'LEARN', 'PRACTICE', 'IMPROVE', 'REASSESS']
    cycle_cols  = [GOLD, LBLU, HexColor('#28A86C'), HexColor('#E07828'), GOLD]
    bw_f = 76; arr_w2 = (CW - 20 - bw_f*5) / 4; bh_f = 34
    cx_start = LM + 20; cy_flow = y

    for i, (lbl, acc) in enumerate(zip(cycle_items, cycle_cols)):
        bx = cx_start + i*(bw_f + arr_w2)
        box(c, bx, cy_flow-bh_f, bw_f, bh_f, fc=acc, r=3)
        T(c, lbl, bx+bw_f/2, cy_flow-bh_f/2-4, BD, 8,
          DEEP if acc == GOLD else WH, 'C')
        if i < len(cycle_items)-1:
            arr_r(c, bx+bw_f+3, cy_flow-bh_f/2, arr_w2-6, GOLD, 1.5, 5)

    # Return arrow below
    L(c, RM-10, cy_flow-bh_f-2, RM-10, cy_flow-bh_f-16, GOLD, 1.2)
    L(c, LM+20, cy_flow-bh_f-16, RM-10, cy_flow-bh_f-16, GOLD, 1.2)
    arr_r(c, LM+14, cy_flow-bh_f-16, 6, GOLD, 1.2, 5)
    T(c, 'Continuous improvement cycle', W/2, cy_flow-bh_f-28, IT, 8, MG, 'C')

    # ── Capabilities ─────────────────────────────────────
    gy = cy_flow - bh_f - 52
    T(c, 'CURRENT CAPABILITIES', LM+20, gy, BD, 7.5, MG)
    L(c, LM+20, gy-8, RM, gy-8, LG, 0.4)

    lcaps = [
        ('Structured Learning Materials',  'Course content organised by subject and module'),
        ('Assignment Delivery',            'Distribute assignments to student batches'),
        ('Student Progress Tracking',      'Monitor individual progress through course material'),
        ('Practice Modules',               'Allow students to practice independently anytime'),
        ('Academic Resource Management',   'Organise and distribute study materials to students'),
        ('Instructor-Led Content Support', 'Faculty can manage and update learning content'),
    ]
    rcaps = [
        ('Course Content Organisation',    'Structure learning material systematically by subject'),
        ('Batch & Subject Organisation',   'Assign content to specific batches and cohorts'),
        ('Assessment-Linked Learning',     'Connect examination results to relevant study content'),
        ('Downloadable Study Resources',   'Students can access reference material for offline study'),
        ('Faculty Content Management',     'Instructors manage what content students can access'),
        ('Progress Reporting',             'Structured reports on student engagement and progress'),
    ]
    dot_y = gy - 26
    for i, (title, sub) in enumerate(lcaps):
        c.setFillColor(GOLD); c.circle(LM+26, dot_y - i*30 - 5, 3.2, fill=1, stroke=0)
        T(c, title, LM+37, dot_y - i*30, BD, 8.5, TX)
        T(c, sub, LM+37, dot_y - i*30 - 12, RG, 7.5, DG)
    for i, (title, sub) in enumerate(rcaps):
        c.setFillColor(LBLU); c.circle(LM+CW/2+18, dot_y - i*30 - 5, 3.2, fill=1, stroke=0)
        T(c, title, LM+CW/2+30, dot_y - i*30, BD, 8.5, TX)
        T(c, sub, LM+CW/2+30, dot_y - i*30 - 12, RG, 7.5, DG)

    # Roadmap banner
    ry = dot_y - len(lcaps)*30 - 22
    box(c, LM+20, ry-44, CW-20, 44, fc=LG, r=3)
    box(c, LM+20, ry-44, 4, 44, fc=LBLU)
    T(c, 'ON THE PRODUCT ROADMAP', LM+34, ry-13, BD, 7.5, LBLU)
    T(c, 'Live classroom integration  ·  Recorded learning modules  ·  AI-assisted study support  ·  Personalised learning paths',
      LM+34, ry-27, RG, 8, DG)
    T(c, 'These capabilities form part of the ZYXEN development roadmap and are not currently deployed.',
      LM+34, ry-40, IT, 7.5, MG)

    footer(c, 6, dark=False)


# ════════════════════════════════════════════════════════════════════════
# PAGE 07 — FOR INSTRUCTORS & LEADERSHIP
# ════════════════════════════════════════════════════════════════════════

def p07(c):
    fill(c, WH); gold_bar(c, 3)
    fill(c, NAVY, 0, 0, 8, H)
    mini_logo(c, dark=False)

    c.saveState(); c.setFont(BD, 130); c.setFillColor(LG)
    c.drawRightString(RM+12, H*0.33, '07'); c.restoreState()

    y = H - 70
    sec_label(c, 'STAKEHOLDER VIEW', LM+20, y)
    y -= 30
    T(c, 'Give Instructors Visibility.', LM+20, y, BD, 24, TX)
    T(c, 'Give Cadets Direction.', LM+20, y-30, BD, 24, TX)
    y -= 68
    b = ("ZYXEN serves every stakeholder in an aviation training environment — from the cadet "
         "sitting an examination to the academy director monitoring cohort readiness.")
    wrap(c, b, LM+20, y, CW-20, RG, 9.5, DG, 16)

    # Two panels
    pw = (CW - 20) / 2 - 8; ph2 = 330; gap2 = 16
    panel_y = y - 44

    # ── LEFT: Instructor Panel ────────────────────────────
    lx = LM + 20
    box(c, lx, panel_y-ph2, pw, ph2, fc=NAVY, r=4)
    box(c, lx, panel_y-ph2, 4, ph2, fc=GOLD)
    # Header area inside card
    box(c, lx+4, panel_y-ph2, pw-4, ph2, fc=NAVY, r=0)
    box(c, lx, panel_y-ph2, pw, ph2, fc=NAVY, r=4)
    box(c, lx, panel_y-ph2, 4, ph2, fc=GOLD)
    # Header text
    T(c, 'FOR INSTRUCTORS', lx+18, panel_y-18, BD, 10, GOLD)
    T(c, 'Faculty & Ground School Staff', lx+18, panel_y-31, RG, 8, MG)
    L(c, lx+14, panel_y-40, lx+pw-10, panel_y-40, HexColor('#1A2D55'), 0.4)

    instr = [
        ('Manage & Schedule Assessments',
         'Create, configure and schedule examinations for any batch at any time.'),
        ('Question Bank Management',
         'Organise questions by subject, topic and difficulty across all DGCA subjects.'),
        ('Monitor Student Performance',
         'Track individual and batch performance across every conducted assessment.'),
        ('Identify Learning Gaps',
         'Surface the specific topics and areas where students are underperforming.'),
        ('Compare Batch Performance',
         'Benchmark multiple student cohorts against each other on identical assessments.'),
        ('Review Assessment Outcomes',
         'Access structured, detailed reports for every examination conducted.'),
        ('Track Progress Over Time',
         'Monitor each student\'s improvement from first attempt through examination readiness.'),
    ]
    iy = panel_y - 55
    for title, sub in instr:
        c.setFillColor(GOLD); c.circle(lx+14, iy-5, 3.2, fill=1, stroke=0)
        T(c, title, lx+25, iy-1, BD, 8.5, WH)
        T(c, sub, lx+25, iy-13, RG, 7.5, MG)
        iy -= 38

    # ── RIGHT: Leadership Panel ───────────────────────────
    rx = lx + pw + gap2
    box(c, rx, panel_y-ph2, pw, ph2, fc=MID, r=4)
    box(c, rx, panel_y-ph2, 4, ph2, fc=GLDL)
    T(c, 'FOR ACADEMY LEADERSHIP', rx+18, panel_y-18, BD, 10, GLDL)
    T(c, 'Directors, HOT & Academic Management', rx+18, panel_y-31, RG, 8, MG)
    L(c, rx+14, panel_y-40, rx+pw-10, panel_y-40, HexColor('#1A3060'), 0.4)

    lead = [
        ('Overall Academic Performance',
         'Understand examination outcomes across all subjects, batches and time periods.'),
        ('Batch Readiness Monitoring',
         'Assess whether a cohort is on track for DGCA examination preparedness.'),
        ('Identify Intervention Areas',
         'Flag subjects or student groups that require additional instruction or support.'),
        ('Centralised Assessment View',
         'A single, structured view of all assessment activity across the institution.'),
        ('Structured Reporting',
         'Performance data presented in a clear, accessible format for leadership review.'),
        ('Examination Activity Overview',
         'Monitor which assessments are being conducted, when, and by which batches.'),
        ('Progress Benchmarking',
         'Track institutional performance trends and identify improvement over time.'),
    ]
    ly2 = panel_y - 55
    for title, sub in lead:
        c.setFillColor(GLDL); c.circle(rx+14, ly2-5, 3.2, fill=1, stroke=0)
        T(c, title, rx+25, ly2-1, BD, 8.5, WH)
        T(c, sub, rx+25, ly2-13, RG, 7.5, MG)
        ly2 -= 38

    footer(c, 7, dark=False)


# ════════════════════════════════════════════════════════════════════════
# PAGE 08 — QUESTION BANK & ASSESSMENT MANAGEMENT
# ════════════════════════════════════════════════════════════════════════

def p08(c):
    fill(c, NAVY); gold_bar(c, 3)
    diag_deco(c, W*0.50, 0, W*0.50, H, HexColor('#112A62'), 1, 34)
    mini_logo(c, dark=True)

    LCW = CW*0.50; RCX = LM + LCW + 28; RCW = RM - RCX

    y = H - 70
    sec_label(c, 'QUESTION BANK & ASSESSMENT', LM, y)
    y -= 30
    T(c, 'Build, Organise and Deliver', LM, y, BD, 24, WH)
    T(c, 'Better Assessments.', LM, y-30, BD, 24, WH)
    y -= 72
    b = ("ZYXEN provides a structured environment for building, managing and delivering "
         "assessments across subjects, batches and examination schedules — with support "
         "for rich question content including diagrams and mathematical notation.")
    y = wrap(c, b, LM, y, LCW, RG, 9.5, HexColor('#7A8FA8'), 16) - 20

    caps = [
        ('Centralised Question Bank',       'All questions organised by subject, topic and question type'),
        ('Subject & Topic Organisation',    'Clean taxonomy aligned to DGCA examination subject structure'),
        ('Rich Question Content',           'Support for text, diagrams and mathematical content types'),
        ('Examination Builder',             'Configure assessments from curated question bank selections'),
        ('Batch Assignment',                'Assign examinations to specific student batches and groups'),
        ('Scheduled Examination Windows',   'Define start and end times for controlled assessment delivery'),
        ('Practice Assessment Mode',        'Students can attempt practice papers at any time independently'),
        ('Controlled Assessment Workflows', 'Structured processes from creation through to result delivery'),
    ]
    for i, (title, sub) in enumerate(caps):
        iy2 = y - i*36
        c.setFillColor(GOLD); c.circle(LM+10, iy2-5, 3.2, fill=1, stroke=0)
        T(c, title, LM+22, iy2, BD, 9, WH)
        T(c, sub, LM+22, iy2-14, RG, 8, MG)

    # ── Right: Workflow Flow ──────────────────────────────
    flow_steps = [
        ('QUESTION BANK',       GOLD,                'Questions organised by subject & topic'),
        ('ASSESSMENT BUILDER',  LBLU,                'Configure examinations from question sets'),
        ('BATCH ASSIGNMENT',    HexColor('#28A86C'), 'Assign to the relevant student cohort'),
        ('EXAMINATION',         HexColor('#E07828'), 'Conducted under controlled conditions'),
        ('ANALYTICS',           HexColor('#9B59B6'), 'Results converted into performance insight'),
    ]
    fh2 = 48; fg2 = 16; fy2 = H - 78

    for i, (label, acc, sub) in enumerate(flow_steps):
        fiy = fy2 - i*(fh2+fg2)
        box(c, RCX, fiy-fh2, RCW, fh2, fc=MID, r=3)
        box(c, RCX, fiy-fh2, 4, fh2, fc=acc)
        T(c, f'{i+1:02d}', RCX+12, fiy-fh2/2-4, BD, 9, acc)
        T(c, label, RCX+28, fiy-fh2*0.37, BD, 10, WH)
        T(c, sub, RCX+28, fiy-fh2*0.37-14, RG, 7.5, MG)
        if i < len(flow_steps)-1:
            arr_d(c, RCX+RCW/2, fiy-fh2-1, fg2-2, acc, 1.5, 5)

    # End note
    ny = fy2 - len(flow_steps)*(fh2+fg2) - 18
    box(c, RCX, ny-34, RCW, 34, fc=HexColor('#0A1E3C'), r=3)
    box(c, RCX, ny-34, 4, 34, fc=GOLD)
    T(c, 'One structured workflow — from question', RCX+14, ny-14, RG, 8, MG)
    T(c, 'creation through to performance insight.', RCX+14, ny-26, RG, 8, MG)

    footer(c, 8)


# ════════════════════════════════════════════════════════════════════════
# PAGE 09 — ASSESSMENT INTEGRITY & RELIABILITY
# ════════════════════════════════════════════════════════════════════════

def p09(c):
    fill(c, DEEP); gold_bar(c, 3)
    diag_deco(c, 0, 0, W, H, HexColor('#0C1A34'), 0.8, 40)
    mini_logo(c, dark=True)

    y = H - 70
    sec_label(c, 'ASSESSMENT INTEGRITY & RELIABILITY', LM, y)
    y -= 32
    T(c, 'Designed for Serious Assessment.', LM, y, BD, 28, WH)

    y -= 62
    b = ("Aviation examinations demand rigor. ZYXEN is built to help academies conduct "
         "assessments with confidence — supporting examination integrity, controlled access, "
         "structured session management and reliable result delivery.")
    y = wrap(c, b, LM, y, CW*0.68, RG, 10.5, HexColor('#7A8FA8'), 17) - 20

    # Central statement bar
    box(c, LM, y-44, CW, 44, fc=MID, r=3)
    box(c, LM, y-44, 4, 44, fc=GOLD)
    L(c, LM+14, y-8, LM+44, y-8, GOLD, 2)
    T(c, '"Designed to help academies conduct assessments with confidence."',
      LM+54, y-22, BD, 11, GLDL)

    y -= 70

    # 6 Integrity pillars
    pillars = [
        ('Examination Integrity Controls',
         ['Measures designed to maintain the integrity of supervised assessments',
          'during live examination sessions, supporting proper conduct throughout.']),
        ('Controlled Access & Session Management',
         ['Structured access workflows ensure only authorised students can commence',
          'and complete assigned assessments within defined parameters.']),
        ('Assessment Monitoring',
         ['Supervisors have appropriate visibility into active examination sessions',
          'to support and maintain proper examination conduct standards.']),
        ('Reliable Submission & Result Delivery',
         ['Submission workflows and result delivery are designed for accuracy,',
          'consistency and structured access by students and instructors.']),
        ('Connectivity Resilience',
         ['Assessment sessions are designed to handle connectivity interruptions',
          'appropriately, protecting the integrity of submitted responses.']),
        ('Structured Examination Scheduling',
         ['Examinations are administered within defined time windows with appropriate',
          'access controls at the start and close of each session.']),
    ]

    pw2 = (CW - 18) / 2; ph3 = 80; pg2 = 14

    for i, (title, body_lines) in enumerate(pillars):
        col3 = i % 2; row = i // 2
        px = LM + col3*(pw2+18)
        py3 = y - row*(ph3+pg2)

        box(c, px, py3-ph3, pw2, ph3, fc=MID, r=3)
        box(c, px, py3-ph3, 4, ph3, fc=GOLD)
        T(c, title, px+14, py3-16, BD, 9, WH)
        L(c, px+14, py3-24, px+pw2-10, py3-24, HexColor('#1A3060'), 0.4)
        for k, bl in enumerate(body_lines):
            T(c, bl, px+14, py3-36-k*13, RG, 8, MG)

    footer(c, 9)


# ════════════════════════════════════════════════════════════════════════
# PAGE 10 — THE ZYXEN LEARNING VISION
# ════════════════════════════════════════════════════════════════════════

def p10(c):
    fill(c, NAVY); gold_bar(c, 3)
    diag_deco(c, 0, 0, W, H*0.38, HexColor('#0E2050'), 0.7, 36)
    mini_logo(c, dark=True)

    y = H - 70
    sec_label(c, 'PLATFORM VISION & ROADMAP', LM, y)
    y -= 32
    T(c, 'Building the Digital Assessment &', LM, y, BD, 22, WH)
    T(c, 'Learning Infrastructure for Aviation Training.', LM, y-28, BD, 22, WH)

    y -= 68
    b = ("ZYXEN is not building an examination website. It is building a long-term digital "
         "learning ecosystem — a purpose-built infrastructure for aviation training institutions "
         "that grows with the needs of their students, faculty and examination requirements.")
    wrap(c, b, LM, y, CW, RG, 9.5, HexColor('#7A8FA8'), 16)

    # ── Horizontal Timeline ───────────────────────────────
    ty = y - 58
    phases = [
        ('TODAY', 'DGCA-Style CBT\nAssessment',
         ['Realistic examination environment', 'Complete question bank management',
          'Instructor controls & scheduling', 'Examination session management',
          'Result delivery & performance data', 'Assessment integrity controls'],
         GOLD, True),
        ('NEXT', 'Advanced Performance\nIntelligence',
         ['Enhanced topic-level analytics', 'Batch benchmarking & ranking',
          'Progress tracking over time', 'Detailed weakness mapping',
          'Advanced instructor reporting', 'Readiness dashboards'],
         LBLU, False),
        ('EXPANSION', 'LMS & Digital\nLearning',
         ['Structured learning content', 'Assignment management',
          'Course & module organisation', 'Student progress tracking',
          'Academic resource library', 'Instructor content tools'],
         HexColor('#28A86C'), False),
        ('FUTURE', 'AI-Assisted Learning\n& Advanced Analytics',
         ['Personalised study support', 'AI-assisted learning content',
          'Adaptive assessment paths', 'Advanced academic intelligence',
          'Institutional performance insights', 'Predictive readiness modelling'],
         HexColor('#9B59B6'), False),
    ]

    ph_w = CW / 4; ph_h = 260; ph_gap = 0
    L(c, LM, ty-20, RM, ty-20, HexColor('#1A2E55'), 1.5)

    for i, (stage, title, items, acc, active) in enumerate(phases):
        px = LM + i*ph_w; pw3 = ph_w - 8

        # Timeline marker
        mx2 = px + ph_w/2
        c.setFillColor(acc); c.circle(mx2, ty-20, 7, fill=1, stroke=0)
        if active:
            c.setStrokeColor(GOLD); c.setLineWidth(2)
            c.circle(mx2, ty-20, 12, fill=0, stroke=1)

        T(c, stage, mx2, ty-5, BD, 8, acc, 'C')

        # Phase card
        card_y = ty - 40
        box(c, px, card_y-ph_h, pw3, ph_h,
            fc=STEEL if active else MID, r=3)
        if active:
            box(c, px, card_y-ph_h, pw3, ph_h, sc=GOLD, lw=1.2, r=3)
        box(c, px, card_y-ph_h, 4, ph_h, fc=acc)

        title_lines = title.split('\n')
        for k, tl in enumerate(title_lines):
            T(c, tl, px+12, card_y-16-k*14, BD, 9,
              WH if active else HexColor('#6A88B8'))

        if active:
            T(c, 'AVAILABLE NOW', px+pw3-8, card_y-ph_h+12, BD, 6.5, GOLD, 'R')

        sep_y = card_y - 14 - len(title_lines)*14 - 8
        L(c, px+12, sep_y, px+pw3-8, sep_y, HexColor('#1A3060'), 0.4)

        for j, item in enumerate(items):
            iy3 = sep_y - 14 - j*22
            c.setFillColor(acc)
            c.circle(px+12, iy3-4, 2.8, fill=1, stroke=0)
            T(c, item, px+22, iy3-8, RG, 7.5,
              WH if active else MG)

    # Roadmap note
    ny2 = ty - 40 - ph_h - 14
    T(c, 'Roadmap capabilities are planned future developments and are not currently deployed.',
      W/2, ny2, IT, 8, HexColor('#4A5E78'), 'C')

    footer(c, 10)


# ════════════════════════════════════════════════════════════════════════
# PAGE 11 — CALL TO ACTION
# ════════════════════════════════════════════════════════════════════════

def p11(c):
    fill(c, DEEP); gold_bar(c, 3)
    diag_deco(c, 0, 0, W, H, HexColor('#0D1B34'), 0.9, 38)

    # Large logo
    lsz = 80; lx = W/2 - lsz/2; ly = H*0.70
    logo_img(c, lx, ly, lsz)

    # Wordmark below logo
    T(c, 'ZYXEN', W/2, ly-22, BD, 34, WH, 'C')
    T(c, 'Aviation Assessment & Learning Platform', W/2, ly-40, RG, 10.5, MG, 'C')

    # Gold divider
    L(c, W/2-90, ly-56, W/2+90, ly-56, GOLD, 1.5)

    # Headline
    T(c, 'See ZYXEN in Action.', W/2, ly-82, BD, 28, WH, 'C')

    # Subline
    T(c, 'The best way to understand the platform is to experience it firsthand.',
      W/2, ly-106, RG, 10.5, MG, 'C')

    # Offer tiles
    offers = [
        ('15-Minute Walkthrough',  '15-minute focused demonstration\nof the platform in action.'),
        ('Complimentary Trial',    'Experience ZYXEN directly\nwithout any commitment.'),
        ('Academy-Tailored Demo',  'Demonstrations configured\nto your institution\'s context.'),
    ]
    ow = 145; oh = 76; tile_gap = 16
    ox_start = W/2 - (ow*3 + tile_gap*2)/2
    oy = ly - 132

    for i, (title, body) in enumerate(offers):
        ox = ox_start + i*(ow+tile_gap)
        box(c, ox, oy-oh, ow, oh, fc=MID, r=4)
        box(c, ox, oy-oh, 4, oh, fc=GOLD)
        T(c, title, ox+ow/2, oy-18, BD, 9, GOLD, 'C')
        L(c, ox+12, oy-26, ox+ow-10, oy-26, HexColor('#1A2D55'), 0.4)
        for k, bl in enumerate(body.split('\n')):
            T(c, bl, ox+ow/2, oy-38-k*13, RG, 8, MG, 'C')

    # CTA Button
    btn_w = 200; btn_h = 38; btn_y = oy - oh - 28
    bx2 = W/2 - btn_w/2
    box(c, bx2, btn_y-btn_h, btn_w, btn_h, fc=GOLD, r=4)
    T(c, 'Request a Demonstration', W/2, btn_y-btn_h/2-4.5, BD, 11.5, DEEP, 'C')

    # Contact
    cy4 = btn_y - btn_h - 32
    L(c, W/2-100, cy4+6, W/2+100, cy4+6, HexColor('#1A2D50'), 0.5)
    T(c, 'zyxen.in', W/2, cy4-8, BD, 11, WH, 'C')
    T(c, 'contact@zyxen.in', W/2, cy4-23, RG, 9, MG, 'C')
    T(c, 'No commitment required  ·  Complimentary for aviation training institutions',
      W/2, cy4-40, RG, 8, HexColor('#4A5A72'), 'C')

    footer(c, 11)


# ════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    c = Canvas.Canvas(OUT, pagesize=A4)
    c.setTitle('ZYXEN Aviation Assessment & Learning Platform — Capability Brochure')
    c.setAuthor('ZYXEN')
    c.setSubject('Institutional Capability Brochure — Assessment & Learning Platform')
    c.setCreator('ZYXEN')

    for fn in [p01, p02, p03, p04, p05, p06, p07, p08, p09, p10, p11]:
        fn(c)
        c.showPage()

    c.save()
    print(f'[+] Saved -> {OUT}')
    import os as _os
    size = _os.path.getsize(OUT) / 1024
    print(f'    File size: {size:.1f} KB')

if __name__ == '__main__':
    main()
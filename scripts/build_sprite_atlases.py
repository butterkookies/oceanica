"""
Build clean, zero-halo transparent RGBA sprite sheets, individual normalized poses,
synthetic multi-frame swim/glide cycles across all growth phases, and JSON atlases
from Oceanica's Studio Ghibli cel-gouache concept & action sheets.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "design-inspos" / "raw-sheets"
INSPO = ROOT / "design-inspos"
OUT_SPRITES = ROOT / "public" / "assets" / "sprites"
OUT_POSES = OUT_SPRITES / "poses"
OUT_SHEETS = OUT_SPRITES / "sheets"
OUT_QA = ROOT / "design-inspos" / "qa-contact"

for d in (OUT_SPRITES, OUT_POSES, OUT_SHEETS, OUT_QA):
    d.mkdir(parents=True, exist_ok=True)


def extract_clean_rgba(
    cell_bgr: np.ndarray,
    *,
    bg_tol: float = 18.0,
    min_comp_area: int = 55,
    clean_neutral_holes: bool = False,
    keep_largest_only: bool = False,
) -> np.ndarray:
    """
    Remove uniform cream/gray paper around an ink-outlined Ghibli sprite via
    exterior flood-fill from image borders, followed by 1.5px soft edge
    feathering & background color decontamination. Never erodes enclosed
    white scales/bellies because flood-fill cannot cross dark sepia ink outlines.
    """
    h, w = cell_bgr.shape[:2]
    # Sample border strip median for accurate per-cell background RGB
    borders = np.concatenate(
        [
            cell_bgr[0:4, :, :].reshape(-1, 3),
            cell_bgr[-4:, :, :].reshape(-1, 3),
            cell_bgr[:, 0:4, :].reshape(-1, 3),
            cell_bgr[:, -4:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    bg_bgr = np.median(borders, axis=0).astype(np.float32)

    # Pad 4px with pure bg color so flood-fill flows cleanly around touches on edge
    pad = 4
    padded = cv2.copyMakeBorder(
        cell_bgr, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=bg_bgr.tolist()
    )
    ph, pw = padded.shape[:2]

    diff = np.linalg.norm(padded.astype(np.float32) - bg_bgr, axis=2)
    # Candidate exterior background pixels (strict luminance floor keeps faint fin tips solid)
    lum = padded.mean(axis=2)
    candidate_bg = ((diff < bg_tol) & (lum > 205)).astype(np.uint8)

    # Connected components on candidate background pixels; only seed-connected exterior becomes transparent
    num_labels, labels = cv2.connectedComponents(candidate_bg, connectivity=4)
    corner_labels = {
        labels[0, 0],
        labels[0, pw - 1],
        labels[ph - 1, 0],
        labels[ph - 1, pw - 1],
    }
    corner_labels.discard(0)
    exterior = np.isin(labels, list(corner_labels))

    if clean_neutral_holes:
        # Clean enclosed bright cream background gaps between stems/leaves (strictly low-chroma cream)
        chroma = padded.max(axis=2).astype(np.float32) - padded.min(axis=2).astype(np.float32)
        strict_paper = (diff < 11.0) & (chroma < 26.0) & (lum > 224)
        exterior = exterior | strict_paper

    fg_mask = (~exterior).astype(np.uint8)

    # Keep main creature/prop components + whiskers/bubbles cleanly while dropping isolated stray dust specs
    n_fg, fg_labels, fg_stats, _ = cv2.connectedComponentsWithStats(fg_mask, connectivity=8)
    clean_fg = np.zeros_like(fg_mask)
    if n_fg > 1:
        areas = fg_stats[1:, cv2.CC_STAT_AREA]
        max_area = int(areas.max())
        max_idx = int(np.argmax(areas)) + 1
        if keep_largest_only:
            clean_fg[fg_labels == max_idx] = 1
        else:
            for lbl in range(1, n_fg):
                area = int(fg_stats[lbl, cv2.CC_STAT_AREA])
                if area >= min_comp_area or area >= max_area * 0.008:
                    clean_fg[fg_labels == lbl] = 1

    # Soften 1.5px perimeter & strip cream paper fringe cleanly
    dist_outside = cv2.distanceTransform((1 - clean_fg).astype(np.uint8), cv2.DIST_L2, 3)
    dist_inside = cv2.distanceTransform(clean_fg.astype(np.uint8), cv2.DIST_L2, 3)

    alpha = np.where(clean_fg > 0, 1.0, 0.0).astype(np.float32)
    # Outer partial fringe where pixel is close to bg_bgr gets soft fade instead of hard jagged cutoff
    edge_band = (clean_fg > 0) & (dist_inside <= 1.6)
    soft = np.clip((diff - 6.0) / max(1.0, bg_tol - 6.0), 0.12, 1.0)
    alpha[edge_band] = np.minimum(1.0, soft[edge_band] * 1.35)

    # Un-premultiply cream halo on edge pixels so transparent PNGs float seamlessly over blue water
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32)
    bg_rgb = bg_bgr[::-1]
    dehalo = (rgb - (1.0 - alpha[..., None]) * bg_rgb[None, None, :]) / np.maximum(
        alpha[..., None], 0.15
    )
    rgb_clean = np.where(alpha[..., None] < 0.99, np.clip(dehalo, 0, 255), rgb)

    rgba = np.dstack([rgb_clean.astype(np.uint8), np.clip(alpha * 255.0, 0, 255).astype(np.uint8)])
    return rgba[pad:-pad, pad:-pad]


def crop_tight(rgba: np.ndarray, pad: int = 8) -> np.ndarray:
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if len(ys) == 0:
        return rgba
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(rgba.shape[0], int(ys.max()) + 1 + pad)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(rgba.shape[1], int(xs.max()) + 1 + pad)
    return rgba[y0:y1, x0:x1]


def rotate_rgba(rgba: np.ndarray, angle_deg: float) -> np.ndarray:
    """Rotate clockwise (+) or CCW (-) around center with clean transparent padding."""
    h, w = rgba.shape[:2]
    rad = math.radians(abs(angle_deg))
    nw = int(math.ceil(w * math.cos(rad) + h * math.sin(rad))) + 8
    nh = int(math.ceil(w * math.sin(rad) + h * math.cos(rad))) + 8
    mat = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), -angle_deg, 1.0)
    mat[0, 2] += (nw - w) / 2.0
    mat[1, 2] += (nh - h) / 2.0
    return cv2.warpAffine(
        rgba,
        mat,
        (nw, nh),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def fit_to_cell(rgba: np.ndarray, cell_w: int, cell_h: int, margin: int = 12) -> np.ndarray:
    """Scale preserving aspect ratio cleanly inside a normalized sprite cell."""
    rgba = crop_tight(rgba, pad=2)
    sh, sw = rgba.shape[:2]
    avail_w = max(8, cell_w - margin * 2)
    avail_h = max(8, cell_h - margin * 2)
    scale = min(avail_w / max(1, sw), avail_h / max(1, sh))
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    resized = cv2.resize(rgba, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LANCZOS4)
    canvas = np.zeros((cell_h, cell_w, 4), dtype=np.uint8)
    ox = (cell_w - nw) // 2
    oy = (cell_h - nh) // 2
    canvas[oy : oy + nh, ox : ox + nw] = resized
    return canvas


def warp_swim_frame(
    rgba: np.ndarray,
    phase: float,
    angle: str,
    amp_scale: float = 1.0,
) -> np.ndarray:
    """
    Synthesize smooth sinusoidal S-curve swimming frames from a canonical nose-left sprite.
    Head (u < 0.18) remains anchored so snout/eyes don't distort; body and fins wave organically.
    """
    h, w = rgba.shape[:2]
    ys, xs = np.where(rgba[:, :, 3] > 20)
    if len(xs) < 10:
        return rgba
    x0, x1 = float(xs.min()), float(xs.max())
    span = max(16.0, x1 - x0)

    grid_y, grid_x = np.indices((h, w), dtype=np.float32)
    u = np.clip((grid_x - x0) / span, 0.0, 1.0)

    # Smooth onset after head (0.16) peaking smoothly toward caudal tail fin (1.0)
    t_env = np.clip((u - 0.16) / 0.84, 0.0, 1.0) ** 1.55
    base_amp = (h * (0.105 if angle == "top" else 0.042)) * amp_scale
    freq = 1.25 if angle == "top" else 1.0
    dy = base_amp * t_env * np.sin(u * (2.0 * math.pi * freq) - phase)

    # Subtle forward squeeze during strong lateral flex keeps spine length natural
    dx = (np.abs(dy) * 0.14) * t_env

    map_x = (grid_x - dx).astype(np.float32)
    map_y = (grid_y - dy).astype(np.float32)
    warped = cv2.remap(
        rgba,
        map_x,
        map_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    return warped


def warp_snail_glide_frame(rgba: np.ndarray, phase: float, angle: str) -> np.ndarray:
    """Subtle undulating foot wave & feeler sway for snail gliding frames."""
    h, w = rgba.shape[:2]
    ys, xs = np.where(rgba[:, :, 3] > 20)
    if len(xs) < 10:
        return rgba
    y0, y1 = float(ys.min()), float(ys.max())
    x0, x1 = float(xs.min()), float(xs.max())
    v = np.clip((np.indices((h, w), dtype=np.float32)[0] - y0) / max(8.0, y1 - y0), 0.0, 1.0)
    u = np.clip((np.indices((h, w), dtype=np.float32)[1] - x0) / max(8.0, x1 - x0), 0.0, 1.0)

    grid_y, grid_x = np.indices((h, w), dtype=np.float32)
    if angle == "side":
        # Foot undulation at bottom (v > 0.72) + whisker tip wave at nose (u < 0.35)
        foot_mask = np.clip((v - 0.72) / 0.28, 0.0, 1.0)
        feeler_mask = np.clip((0.34 - u) / 0.34, 0.0, 1.0) * np.clip((v - 0.30) / 0.50, 0.0, 1.0)
        dy = (h * 0.015) * foot_mask * np.sin(u * 12.0 - phase) + (h * 0.024) * feeler_mask * np.sin(phase)
        dx = (w * 0.012) * feeler_mask * np.cos(phase)
    else:
        feeler_mask = np.clip((0.32 - u) / 0.32, 0.0, 1.0)
        dy = (h * 0.025) * feeler_mask * np.sin(phase + u * 4.0)
        dx = (w * 0.01) * np.sin(phase) * (1.0 - feeler_mask * 0.5)

    return cv2.remap(
        rgba,
        (grid_x - dx).astype(np.float32),
        (grid_y - dy).astype(np.float32),
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def crop_rect(img: np.ndarray, rx0: float, ry0: float, rx1: float, ry1: float) -> np.ndarray:
    h, w = img.shape[:2]
    return img[int(h * ry0) : int(h * ry1), int(w * rx0) : int(w * rx1)]


def remove_isolated_right_speck(rgba: np.ndarray, min_ratio: float = 0.03) -> np.ndarray:
    """Drop tiny food speck in Plakat food strike pose cleanly."""
    mask = (rgba[:, :, 3] > 20).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 1:
        return rgba
    max_area = int(stats[1:, cv2.CC_STAT_AREA].max())
    keep = np.zeros_like(mask)
    for i in range(1, n):
        if int(stats[i, cv2.CC_STAT_AREA]) >= max_area * min_ratio:
            keep[labels == i] = 1
    out = rgba.copy()
    out[:, :, 3] = out[:, :, 3] * keep
    return out


def make_juvenile_comet_side(adult_rgba: np.ndarray) -> np.ndarray:
    """Synthesize agile mid-tail Juvenile Comet Side pose cleanly from Comet Adult."""
    h, w = adult_rgba.shape[:2]
    grid_y, grid_x = np.indices((h, w), dtype=np.float32)
    # Slightly compact the rear tail ribbon horizontally by 16%
    pivot = w * 0.58
    src_x = np.where(grid_x > pivot, pivot + (grid_x - pivot) * 1.18, grid_x)
    src_y = np.where(grid_x > pivot, h * 0.5 + (grid_y - h * 0.5) * 1.12, grid_y)
    return cv2.remap(
        adult_rgba,
        src_x.astype(np.float32),
        src_y.astype(np.float32),
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def build_all() -> None:
    # Load all source sheets
    im_koi_gf = cv2.imread(str(INSPO / "concept-koi-goldfish-turnarounds.jpg"))
    im_betta_sn = cv2.imread(str(INSPO / "concept-betta-snails-turnarounds.jpg"))
    im_props = cv2.imread(str(INSPO / "concept-botanical-decor-props.jpg"))
    im_hm_top = cv2.imread(str(RAW / "halfmoon_betta_top.jpg"))
    im_modular = cv2.imread(str(RAW / "custom_fish_modular_sheet.jpg"))
    im_koi_grow = cv2.imread(str(RAW / "sheet_koi_growth.jpg"))
    im_betta_grow = cv2.imread(str(RAW / "sheet_betta_growth.jpg"))
    im_gf_grow = cv2.imread(str(RAW / "sheet_goldfish_growth.jpg"))
    im_sn_grow = cv2.imread(str(RAW / "sheet_snails_growth.jpg"))
    im_koi_act = cv2.imread(str(RAW / "sheet_koi_comet_actions.jpg"))
    im_betta_act = cv2.imread(str(RAW / "sheet_betta_actions.jpg"))
    im_oranda_act = cv2.imread(str(RAW / "sheet_oranda_snail_actions.jpg"))

    def ex(im: np.ndarray, rx0: float, ry0: float, rx1: float, ry1: float, **kw) -> np.ndarray:
        return crop_tight(extract_clean_rgba(crop_rect(im, rx0, ry0, rx1, ry1), **kw), pad=6)

    # 1. Extract canonical base sprites per species (NOSE LEFT -X)
    # Turnaround crops carefully above text lines in concept-betta-snails & sheet_oranda_snail_actions
    raw_poses: dict[str, dict[str, np.ndarray]] = {
        "koi_kohaku": {
            "fry_side": ex(im_koi_grow, 0.0, 0.0, 0.32, 0.31, keep_largest_only=True),
            "fry_top": ex(im_koi_grow, 0.0, 0.33, 0.32, 0.65, keep_largest_only=True),
            "juvenile_side": ex(im_koi_grow, 0.32, 0.0, 0.64, 0.31, keep_largest_only=True),
            "juvenile_top": ex(im_koi_grow, 0.32, 0.33, 0.64, 0.65, keep_largest_only=True),
            "adult_side": ex(im_koi_gf, 0.0, 0.02, 0.54, 0.25, keep_largest_only=True),
            "adult_top": ex(im_koi_gf, 0.54, 0.02, 1.0, 0.25, keep_largest_only=True),
            "eat_side": ex(im_koi_act, 0.0, 0.0, 0.33, 0.35, keep_largest_only=True),
            "scavenge_side": ex(im_koi_act, 0.33, 0.0, 0.655, 0.35, keep_largest_only=True),
            "turn_left_top": rotate_rgba(ex(im_koi_act, 0.0, 0.35, 0.34, 1.0, keep_largest_only=True), -90),
            "turn_right_top": rotate_rgba(ex(im_koi_act, 0.34, 0.35, 0.67, 1.0, keep_largest_only=True), -90),
        },
        "koi_sanke": {
            "fry_side": ex(im_koi_grow, 0.0, 0.0, 0.32, 0.31, keep_largest_only=True),
            "fry_top": ex(im_koi_grow, 0.0, 0.33, 0.32, 0.65, keep_largest_only=True),
            "juvenile_side": ex(im_koi_grow, 0.645, 0.0, 1.0, 0.31, keep_largest_only=True),
            "juvenile_top": ex(im_koi_grow, 0.645, 0.33, 1.0, 0.65, keep_largest_only=True),
            "adult_side": ex(im_koi_gf, 0.0, 0.25, 0.54, 0.49, keep_largest_only=True),
            "adult_top": ex(im_koi_gf, 0.54, 0.25, 1.0, 0.49, keep_largest_only=True),
        },
        "betta_halfmoon": {
            "fry_side": ex(im_betta_grow, 0.0, 0.0, 0.32, 0.34, keep_largest_only=True),
            "fry_top": ex(im_betta_grow, 0.0, 0.34, 0.32, 0.66, keep_largest_only=True),
            "juvenile_side": ex(im_betta_grow, 0.32, 0.0, 0.66, 0.35, keep_largest_only=True),
            "juvenile_top": ex(im_betta_grow, 0.32, 0.34, 0.665, 0.65, keep_largest_only=True),
            "adult_side": ex(im_betta_sn, 0.0, 0.02, 0.50, 0.265, keep_largest_only=True),
            "adult_top": ex(im_hm_top, 0.05, 0.05, 0.95, 0.95, keep_largest_only=True),
            "flare_side": cv2.flip(ex(im_betta_act, 0.0, 0.0, 0.35, 0.48, keep_largest_only=True), 1),
            "surface_gulp_side": ex(im_betta_act, 0.34, 0.0, 0.655, 0.48, keep_largest_only=True),
            "rest_side": ex(im_betta_act, 0.67, 0.0, 1.0, 0.48, keep_largest_only=True),
            "scurve_top": rotate_rgba(ex(im_betta_act, 0.34, 0.48, 0.68, 1.0, keep_largest_only=True), 95),
            "flare_top": rotate_rgba(ex(im_betta_act, 0.67, 0.48, 1.0, 1.0, keep_largest_only=True), -90),
            "glide_alt_top": ex(im_betta_grow, 0.32, 0.65, 0.665, 1.0, keep_largest_only=True),
        },
        "betta_plakat": {
            "fry_side": ex(im_betta_grow, 0.0, 0.0, 0.32, 0.34, keep_largest_only=True),
            "fry_top": ex(im_betta_grow, 0.0, 0.34, 0.32, 0.66, keep_largest_only=True),
            "juvenile_side": ex(im_betta_grow, 0.66, 0.0, 1.0, 0.35, keep_largest_only=True),
            "juvenile_top": ex(im_betta_grow, 0.66, 0.34, 1.0, 0.65, keep_largest_only=True),
            "subadult_top": ex(im_betta_grow, 0.66, 0.65, 1.0, 1.0, keep_largest_only=True),
            "adult_side": ex(im_betta_sn, 0.0, 0.30, 0.50, 0.50, keep_largest_only=True),
            "adult_top": ex(im_betta_sn, 0.50, 0.30, 1.0, 0.50, keep_largest_only=True),
            "eat_side": remove_isolated_right_speck(
                cv2.flip(ex(im_betta_act, 0.0, 0.48, 0.35, 1.0), 1), min_ratio=0.04
            ),
        },
        "goldfish_oranda": {
            "fry_side": ex(im_gf_grow, 0.0, 0.0, 0.34, 0.34, keep_largest_only=True),
            "fry_top": ex(im_gf_grow, 0.0, 0.34, 0.34, 0.66, keep_largest_only=True),
            "juvenile_side": ex(im_gf_grow, 0.33, 0.0, 0.67, 0.34, keep_largest_only=True),
            "juvenile_calico_side": ex(im_gf_grow, 0.33, 0.33, 0.67, 0.68, keep_largest_only=True),
            "juvenile_top": ex(im_gf_grow, 0.33, 0.66, 0.67, 1.0, keep_largest_only=True),
            "subadult_smooth_top": ex(im_gf_grow, 0.0, 0.66, 0.34, 1.0, keep_largest_only=True),
            "adult_side": ex(im_koi_gf, 0.0, 0.49, 0.54, 0.74, keep_largest_only=True),
            "adult_top": ex(im_koi_gf, 0.54, 0.49, 1.0, 0.74, keep_largest_only=True),
            "eat_side": ex(im_oranda_act, 0.0, 0.0, 0.35, 0.39, keep_largest_only=True),
            "flex_side": ex(im_oranda_act, 0.66, 0.50, 1.0, 0.89, keep_largest_only=True),
            "waddle_top": rotate_rgba(ex(im_koi_act, 0.67, 0.35, 1.0, 1.0, keep_largest_only=True), -90),
        },
        "goldfish_comet": {
            "fry_side": ex(im_gf_grow, 0.66, 0.0, 1.0, 0.34, keep_largest_only=True),
            "fry_top": ex(im_gf_grow, 0.66, 0.34, 1.0, 0.66, keep_largest_only=True),
            "juvenile_top": ex(im_gf_grow, 0.66, 0.66, 1.0, 1.0, keep_largest_only=True),
            "adult_side": ex(im_koi_gf, 0.0, 0.74, 0.54, 0.99, keep_largest_only=True),
            "adult_top": ex(im_koi_gf, 0.545, 0.74, 1.0, 0.99, keep_largest_only=True),
            "sprint_side": ex(im_koi_act, 0.65, 0.0, 1.0, 0.35, keep_largest_only=True),
        },
        "snail_mystery": {
            "fry_side": ex(im_sn_grow, 0.0, 0.0, 0.32, 0.50, keep_largest_only=True),
            "fry_top": cv2.flip(ex(im_sn_grow, 0.0, 0.50, 0.32, 1.0, keep_largest_only=True), 1),
            "juvenile_side": ex(im_sn_grow, 0.31, 0.0, 0.68, 0.50, keep_largest_only=True),
            "juvenile_top": cv2.flip(ex(im_sn_grow, 0.32, 0.50, 0.68, 1.0, keep_largest_only=True), 1),
            "adult_side": ex(im_betta_sn, 0.0, 0.53, 0.48, 0.74, keep_largest_only=True),
            "adult_top": ex(im_betta_sn, 0.48, 0.53, 1.0, 0.74, keep_largest_only=True),
            "siphon_side": cv2.flip(ex(im_oranda_act, 0.36, 0.0, 0.655, 0.39, keep_largest_only=True), 1),
            "parasnail_side": ex(im_oranda_act, 0.67, 0.0, 1.0, 0.39, keep_largest_only=True),
            "tuck_side": ex(im_oranda_act, 0.0, 0.50, 0.34, 0.89, keep_largest_only=True),
        },
        "snail_nerite": {
            "fry_side": cv2.resize(
                ex(im_sn_grow, 0.68, 0.0, 1.0, 0.50, keep_largest_only=True),
                (0, 0), fx=0.72, fy=0.72, interpolation=cv2.INTER_AREA
            ),
            "fry_top": cv2.resize(
                cv2.flip(ex(im_sn_grow, 0.68, 0.50, 1.0, 1.0, keep_largest_only=True), 1),
                (0, 0), fx=0.72, fy=0.72, interpolation=cv2.INTER_AREA
            ),
            "juvenile_side": ex(im_sn_grow, 0.68, 0.0, 1.0, 0.50, keep_largest_only=True),
            "juvenile_top": cv2.flip(ex(im_sn_grow, 0.68, 0.50, 1.0, 1.0, keep_largest_only=True), 1),
            "adult_side": ex(im_betta_sn, 0.0, 0.77, 0.48, 0.96, keep_largest_only=True),
            "adult_top": ex(im_betta_sn, 0.48, 0.77, 1.0, 0.96, keep_largest_only=True),
            "graze_side": cv2.flip(ex(im_oranda_act, 0.34, 0.50, 0.68, 0.89, keep_largest_only=True), 1),
        },
    }

    # Add juvenile_side for Comet directly from adult_side with sleeker youth fin
    raw_poses["goldfish_comet"]["juvenile_side"] = make_juvenile_comet_side(
        raw_poses["goldfish_comet"]["adult_side"]
    )

    # Botanical Decor Props (enable neutral paper pocket cleanup inside stems/leaves!)
    decor_poses: dict[str, np.ndarray] = {
        "java_fern": ex(im_props, 0.02, 0.02, 0.37, 0.53, clean_neutral_holes=True),
        "anubias": ex(im_props, 0.37, 0.02, 0.72, 0.52, clean_neutral_holes=True),
        "moss_ball": ex(im_props, 0.72, 0.02, 0.98, 0.50),
        "cactus": ex(im_props, 0.04, 0.53, 0.30, 0.98),
        "driftwood_stones": ex(im_props, 0.30, 0.53, 0.73, 0.98, clean_neutral_holes=True),
        "bubbler": crop_tight(
            extract_clean_rgba(
                crop_rect(im_props, 0.75, 0.46, 0.96, 0.97), min_comp_area=12
            ),
            pad=6,
        ),
    }

    # Custom Fish Modular Parts
    modular_poses: dict[str, np.ndarray] = {
        "body_fusiform_side": ex(im_modular, 0.02, 0.03, 0.35, 0.35),
        "body_compressiform_side": ex(im_modular, 0.35, 0.03, 0.66, 0.35),
        "body_globiform_side": ex(im_modular, 0.66, 0.03, 0.98, 0.35),
        "body_fusiform_top": ex(im_modular, 0.02, 0.35, 0.35, 0.63),
        "body_compressiform_top": ex(im_modular, 0.35, 0.35, 0.66, 0.63),
        "body_globiform_top": ex(im_modular, 0.66, 0.35, 0.98, 0.63),
        "tail_halfmoon": ex(im_modular, 0.03, 0.63, 0.28, 0.98),
        "tail_crowntail": ex(im_modular, 0.28, 0.63, 0.53, 0.98),
        "tail_forked": ex(im_modular, 0.53, 0.63, 0.77, 0.98),
        "tail_double": ex(im_modular, 0.77, 0.63, 0.97, 0.98),
    }

    # 2. Build dynamic per-species Sprite Sheets + JSON Atlas Manifest
    CELL_W, CELL_H = 256, 176
    SWIM_FRAMES = 6
    GLIDE_FRAMES = 4
    atlas_manifest: dict[str, object] = {
        "version": 1,
        "artStyle": "Studio Ghibli Cel-Gouache (Sunlit Conservatory)",
        "cellSize": {"width": CELL_W, "height": CELL_H},
        "canonicalDirection": "left (-X)",
        "species": {},
        "decor": {},
        "customModular": {},
    }

    for sp_id, base_map in raw_poses.items():
        sp_dir = OUT_POSES / sp_id
        sp_dir.mkdir(parents=True, exist_ok=True)
        is_snail = sp_id.startswith("snail_")
        n_loop = GLIDE_FRAMES if is_snail else SWIM_FRAMES

        # Save all raw high-res individual poses first
        for pose_name, rgba in base_map.items():
            Image.fromarray(rgba, "RGBA").save(sp_dir / f"{pose_name}.png")

        # Build rows for the packed dynamic species sheet
        rows: list[tuple[str, list[tuple[str, np.ndarray]]]] = []
        for phase in ("fry", "juvenile", "adult"):
            amp = 0.72 if phase == "fry" else (0.9 if phase == "juvenile" else 1.0)
            for ang in ("side", "top"):
                src = base_map[f"{phase}_{ang}"]
                norm_base = fit_to_cell(src, CELL_W, CELL_H, margin=14)
                frames: list[tuple[str, np.ndarray]] = []
                for idx in range(n_loop):
                    theta = (idx / n_loop) * 2.0 * math.pi
                    frame_rgba = (
                        warp_snail_glide_frame(norm_base, theta, ang)
                        if is_snail
                        else warp_swim_frame(norm_base, theta, ang, amp_scale=amp)
                    )
                    frame_name = f"{phase}_{ang}_{'glide' if is_snail else 'swim'}_{idx}"
                    frames.append((frame_name, frame_rgba))
                rows.append((f"{phase}_{ang}_{'glide' if is_snail else 'swim'}", frames))

        # Behavior / action poses row
        action_keys = [
            k
            for k in base_map.keys()
            if not any(k.startswith(f"{p}_{a}") for p in ("fry", "juvenile", "adult") for a in ("side", "top"))
        ]
        if action_keys:
            for start in range(0, len(action_keys), n_loop):
                chunk = action_keys[start : start + n_loop]
                frames = [(k, fit_to_cell(base_map[k], CELL_W, CELL_H, margin=14)) for k in chunk]
                rows.append((f"behaviors_{start // n_loop}", frames))

        # Render packed PNG sheet
        cols = n_loop
        sheet_w = cols * CELL_W
        sheet_h = len(rows) * CELL_H
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
        sp_meta: dict[str, object] = {
            "sheet": f"sheets/{sp_id}_spritesheet.png",
            "sheetSize": {"width": sheet_w, "height": sheet_h},
            "growthPhases": {
                "fry": {"minGrowth": 0.0, "maxGrowth": 0.35, "scaleMultiplier": 0.48},
                "juvenile": {"minGrowth": 0.35, "maxGrowth": 0.75, "scaleMultiplier": 0.74},
                "adult": {"minGrowth": 0.75, "maxGrowth": 1.0, "scaleMultiplier": 1.0},
            },
            "angles": ["side", "top"],
            "animations": {},
            "frames": {},
        }

        for r_idx, (anim_name, frame_list) in enumerate(rows):
            frame_ids = []
            for c_idx, (frame_id, f_rgba) in enumerate(frame_list):
                x = c_idx * CELL_W
                y = r_idx * CELL_H
                sheet.paste(Image.fromarray(f_rgba, "RGBA"), (x, y))
                frame_ids.append(frame_id)
                sp_meta["frames"][frame_id] = {
                    "x": x,
                    "y": y,
                    "w": CELL_W,
                    "h": CELL_H,
                    "row": r_idx,
                    "col": c_idx,
                }
            sp_meta["animations"][anim_name] = {
                "frames": frame_ids,
                "fps": 6 if is_snail else 10,
                "loop": not anim_name.startswith("behaviors_"),
            }

        sheet_path = OUT_SHEETS / f"{sp_id}_spritesheet.png"
        sheet.save(sheet_path)
        atlas_manifest["species"][sp_id] = sp_meta

    # Pack Botanical Props Sheet
    PROP_CELL = 320
    prop_sheet = Image.new("RGBA", (PROP_CELL * 3, PROP_CELL * 2), (0, 0, 0, 0))
    prop_dir = OUT_POSES / "decor"
    prop_dir.mkdir(parents=True, exist_ok=True)
    for idx, (pid, rgba) in enumerate(decor_poses.items()):
        Image.fromarray(rgba, "RGBA").save(prop_dir / f"{pid}.png")
        norm = fit_to_cell(rgba, PROP_CELL, PROP_CELL, margin=14)
        col, row = idx % 3, idx // 3
        prop_sheet.paste(Image.fromarray(norm, "RGBA"), (col * PROP_CELL, row * PROP_CELL))
        atlas_manifest["decor"][pid] = {
            "file": f"poses/decor/{pid}.png",
            "x": col * PROP_CELL,
            "y": row * PROP_CELL,
            "w": PROP_CELL,
            "h": PROP_CELL,
        }
    prop_sheet.save(OUT_SHEETS / "botanical_props_spritesheet.png")

    # Pack Custom Fish Modular Sheet
    MOD_W, MOD_H = 256, 176
    mod_sheet = Image.new("RGBA", (MOD_W * 4, MOD_H * 3), (0, 0, 0, 0))
    mod_dir = OUT_POSES / "custom_modular"
    mod_dir.mkdir(parents=True, exist_ok=True)
    mod_grid = [
        ("body_fusiform_side", 0, 0),
        ("body_compressiform_side", 0, 1),
        ("body_globiform_side", 0, 2),
        ("body_fusiform_top", 1, 0),
        ("body_compressiform_top", 1, 1),
        ("body_globiform_top", 1, 2),
        ("tail_halfmoon", 2, 0),
        ("tail_crowntail", 2, 1),
        ("tail_forked", 2, 2),
        ("tail_double", 2, 3),
    ]
    for mid, r, c in mod_grid:
        rgba = modular_poses[mid]
        Image.fromarray(rgba, "RGBA").save(mod_dir / f"{mid}.png")
        norm = fit_to_cell(rgba, MOD_W, MOD_H, margin=12)
        mod_sheet.paste(Image.fromarray(norm, "RGBA"), (c * MOD_W, r * MOD_H))
        atlas_manifest["customModular"][mid] = {
            "file": f"poses/custom_modular/{mid}.png",
            "x": c * MOD_W,
            "y": r * MOD_H,
            "w": MOD_W,
            "h": MOD_H,
        }
    mod_sheet.save(OUT_SHEETS / "custom_fish_modular_spritesheet.png")

    (OUT_SPRITES / "atlas.json").write_text(json.dumps(atlas_manifest, indent=2), encoding="utf-8")

    # 3. Generate readable checkerboard QA previews so we verify clean alpha & orientation visually
    for png in sorted(OUT_SHEETS.glob("*.png")):
        sp = Image.open(png).convert("RGBA")
        # Composite onto soft sky-blue/checkerboard watercolor water swatch to detect ANY halos/orientation bugs
        w, h = sp.size
        bg = Image.new("RGBA", (w, h), (195, 232, 228, 255))
        draw = ImageDraw.Draw(bg)
        tile = 32
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                if ((x // tile) + (y // tile)) % 2 == 0:
                    draw.rectangle([x, y, x + tile, y + tile], fill=(210, 240, 236, 255))
        for x in range(0, w, CELL_W if "props" not in png.name else PROP_CELL):
            draw.line([(x, 0), (x, h)], fill=(120, 165, 165, 110), width=1)
        for y in range(0, h, CELL_H if "props" not in png.name else PROP_CELL):
            draw.line([(0, y), (w, y)], fill=(120, 165, 165, 110), width=1)
        bg.alpha_composite(sp)
        bg.convert("RGB").save(OUT_QA / f"qa_{png.stem}.jpg", quality=92)

    total_frames = sum(len(s["frames"]) for s in atlas_manifest["species"].values())
    print(
        f"Built {len(atlas_manifest['species'])} species sheets ({total_frames} frames), "
        f"{len(atlas_manifest['decor'])} botanical props, "
        f"{len(atlas_manifest['customModular'])} modular custom parts."
    )


if __name__ == "__main__":
    build_all()

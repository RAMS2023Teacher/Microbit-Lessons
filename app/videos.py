"""Turn a teacher-supplied video link into something embeddable."""
import re
from urllib.parse import parse_qs, urlparse

from .models import LessonVideo, db


def embed_info(url: str | None):
    if not url:
        return None
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return None
    host = p.netloc.lower().removeprefix("www.").removeprefix("m.")
    vid = None
    if host == "youtu.be":
        vid = p.path.strip("/").split("/")[0]
    elif host in ("youtube.com", "youtube-nocookie.com"):
        if p.path == "/watch":
            vid = parse_qs(p.query).get("v", [None])[0]
        else:
            m = re.match(r"^/(embed|shorts|live)/([\w-]+)", p.path)
            vid = m.group(2) if m else None
    if vid and re.fullmatch(r"[\w-]{6,20}", vid):
        return {"kind": "iframe", "src": f"https://www.youtube-nocookie.com/embed/{vid}"}
    if host == "drive.google.com":
        m = re.search(r"/file/d/([\w-]+)", p.path)
        if m:
            return {"kind": "iframe", "src": f"https://drive.google.com/file/d/{m.group(1)}/preview"}
    if host == "vimeo.com":
        m = re.match(r"^/(\d+)", p.path)
        if m:
            return {"kind": "iframe", "src": f"https://player.vimeo.com/video/{m.group(1)}"}
    if re.search(r"\.(mp4|webm|ogg)$", p.path, re.I):
        return {"kind": "video", "src": url}
    return {"kind": "link", "src": url}


def video_for(lesson_id: str):
    row = db.session.get(LessonVideo, lesson_id)
    return embed_info(row.url) if row else None


def all_video_urls():
    return {v.lesson_id: v.url for v in LessonVideo.query.all()}

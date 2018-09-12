const FONT = '"Times New Roman"';

class State {
    constructor(x, y, name = '') {
        this.x = x;
        this.y = y;
        this.mouseOffsetX = 0;
        this.mouseOffsetY = 0;
        this.isStartState = false;
        this.isAcceptState = false;
        this.withSymbol = name;
        this.isEvaluating = false;
        this.isAccepted = false;
    }

    setMouseStart(x, y) {
        this.mouseOffsetX = this.x - x;
        this.mouseOffsetY = this.y - y;
    }

    setAnchorPoint(x, y) {
        this.x = x + this.mouseOffsetX;
        this.y = y + this.mouseOffsetY;
    }

    draw(c) {
        // draw the circle
        c.beginPath();
        c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
        c.stroke();

        // draw the withSymbol
        drawText(c, this.withSymbol, this.x, this.y, null, selectedObject == this);

        // draw a double circle for an accept state
        if (this.isAcceptState) {
            c.beginPath();
            c.arc(this.x, this.y, nodeRadius - 6, 0, 2 * Math.PI, false);
            c.stroke();
        }

        // draw arrow for a start state
        if (this.isStartState) {
            c.beginPath();
            c.moveTo(this.x - nodeRadius - 20, this.y);
            c.lineTo(this.x - nodeRadius, this.y);
            c.stroke();
            c.beginPath();
            drawArrow(
                c,
                this.x - nodeRadius,
                this.y,
                0
            );
            c.stroke();
        }
    }

    closestPointOnCircle(x, y) {
        var dx = x - this.x;
        var dy = y - this.y;
        var scale = Math.sqrt(dx * dx + dy * dy);
        return {
            x: this.x + (dx * nodeRadius) / scale,
            y: this.y + (dy * nodeRadius) / scale
        };
    }

    containsPoint(x, y) {
        return (
            (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y) <
            nodeRadius * nodeRadius
        );
    }
}

class Transition {
    constructor(a, b) {
        this.fromState = a;
        this.toState = b;
        this.withSymbol = "";
        this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line

        // make anchor point relative to the locations of fromState and toState
        this.parallelPart = 0.5; // percentage from fromState to toState
        this.perpendicularPart = 0; // pixels from line between fromState and toState

        this.isEvaluating = false;
    }

    getAnchorPoint() {
        var dx = this.toState.x - this.fromState.x;
        var dy = this.toState.y - this.fromState.y;
        var scale = Math.sqrt(dx * dx + dy * dy);
        return {
            x:
            this.fromState.x +
            dx * this.parallelPart -
            (dy * this.perpendicularPart) / scale,
            y:
            this.fromState.y +
            dy * this.parallelPart +
            (dx * this.perpendicularPart) / scale
        };
    }

    setAnchorPoint(x, y) {
        var dx = this.toState.x - this.fromState.x;
        var dy = this.toState.y - this.fromState.y;
        var scale = Math.sqrt(dx * dx + dy * dy);
        this.parallelPart =
            (dx * (x - this.fromState.x) + dy * (y - this.fromState.y)) / (scale * scale);
        this.perpendicularPart =
            (dx * (y - this.fromState.y) - dy * (x - this.fromState.x)) / scale;
        // snap to a straight line
        if (
            this.parallelPart > 0 &&
            this.parallelPart < 1 &&
            Math.abs(this.perpendicularPart) < snapToPadding
        ) {
            this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
            this.perpendicularPart = 0;
        }
    }

    getEndPointsAndCircle() {
        if (this.perpendicularPart == 0) {
            var midX = (this.fromState.x + this.toState.x) / 2;
            var midY = (this.fromState.y + this.toState.y) / 2;
            var start = this.fromState.closestPointOnCircle(midX, midY);
            var end = this.toState.closestPointOnCircle(midX, midY);
            return {
                hasCircle: false,
                startX: start.x,
                startY: start.y,
                endX: end.x,
                endY: end.y
            };
        }
        var anchor = this.getAnchorPoint();
        var circle = circleFromThreePoints(
            this.fromState.x,
            this.fromState.y,
            this.toState.x,
            this.toState.y,
            anchor.x,
            anchor.y
        );
        var isReversed = this.perpendicularPart > 0;
        var reverseScale = isReversed ? 1 : -1;
        var startAngle =
            Math.atan2(this.fromState.y - circle.y, this.fromState.x - circle.x) -
            (reverseScale * nodeRadius) / circle.radius;
        var endAngle =
            Math.atan2(this.toState.y - circle.y, this.toState.x - circle.x) +
            (reverseScale * nodeRadius) / circle.radius;
        var startX = circle.x + circle.radius * Math.cos(startAngle);
        var startY = circle.y + circle.radius * Math.sin(startAngle);
        var endX = circle.x + circle.radius * Math.cos(endAngle);
        var endY = circle.y + circle.radius * Math.sin(endAngle);
        return {
            hasCircle: true,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            startAngle: startAngle,
            endAngle: endAngle,
            circleX: circle.x,
            circleY: circle.y,
            circleRadius: circle.radius,
            reverseScale: reverseScale,
            isReversed: isReversed
        };
    }

    draw(c) {
        var stuff = this.getEndPointsAndCircle();
        // draw arc
        c.beginPath();
        if (stuff.hasCircle) {
            c.arc(
                stuff.circleX,
                stuff.circleY,
                stuff.circleRadius,
                stuff.startAngle,
                stuff.endAngle,
                stuff.isReversed
            );
        } else {
            c.moveTo(stuff.startX, stuff.startY);
            c.lineTo(stuff.endX, stuff.endY);
        }
        c.stroke();
        // draw the head of the arrow
        if (stuff.hasCircle) {
            drawArrow(
                c,
                stuff.endX,
                stuff.endY,
                stuff.endAngle - stuff.reverseScale * (Math.PI / 2)
            );
        } else {
            drawArrow(
                c,
                stuff.endX,
                stuff.endY,
                Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX)
            );
        }
        // draw the withSymbol
        if (stuff.hasCircle) {
            var startAngle = stuff.startAngle;
            var endAngle = stuff.endAngle;
            if (endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }
            var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
            var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
            var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
            drawText(c, this.withSymbol, textX, textY, textAngle, selectedObject == this);
        } else {
            var textX = (stuff.startX + stuff.endX) / 2;
            var textY = (stuff.startY + stuff.endY) / 2;
            var textAngle = Math.atan2(
                stuff.endX - stuff.startX,
                stuff.startY - stuff.endY
            );
            drawText(
                c,
                this.withSymbol,
                textX,
                textY,
                textAngle + this.lineAngleAdjust,
                selectedObject == this
            );
        }
    }

    containsPoint(x, y) {
        var stuff = this.getEndPointsAndCircle();
        if (stuff.hasCircle) {
            var dx = x - stuff.circleX;
            var dy = y - stuff.circleY;
            var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
            if (Math.abs(distance) < hitTargetPadding) {
                var angle = Math.atan2(dy, dx);
                var startAngle = stuff.startAngle;
                var endAngle = stuff.endAngle;
                if (stuff.isReversed) {
                    var temp = startAngle;
                    startAngle = endAngle;
                    endAngle = temp;
                }
                if (endAngle < startAngle) {
                    endAngle += Math.PI * 2;
                }
                if (angle < startAngle) {
                    angle += Math.PI * 2;
                } else if (angle > endAngle) {
                    angle -= Math.PI * 2;
                }
                return angle > startAngle && angle < endAngle;
            }
        } else {
            var dx = stuff.endX - stuff.startX;
            var dy = stuff.endY - stuff.startY;
            var length = Math.sqrt(dx * dx + dy * dy);
            var percent =
                (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
            var distance =
                (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
            return (
                percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding
            );
        }
        return false;
    }
}


class SelfTransition {
    constructor(node, mouse) {
        this.fromState = node;
        this.toState = node;
        this.anchorAngle = 0;
        this.mouseOffsetAngle = 0;
        this.withSymbol = "";

        this.isEvaluating = false;

        if (mouse) {
            this.setAnchorPoint(mouse.x, mouse.y);
        }
    }

    setMouseStart(x, y) {
        this.mouseOffsetAngle =
            this.anchorAngle - Math.atan2(y - this.fromState.y, x - this.fromState.x);
    }

    setAnchorPoint(x, y) {
        this.anchorAngle =
            Math.atan2(y - this.fromState.y, x - this.fromState.x) + this.mouseOffsetAngle;
        // snap to 90 degrees
        var snap = Math.round(this.anchorAngle / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(this.anchorAngle - snap) < 0.1) this.anchorAngle = snap;
        // keep in the range -pi to pi so our containsPoint() function always works
        if (this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
        if (this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
    }

    getEndPointsAndCircle() {
        var circleX = this.fromState.x + 1.5 * nodeRadius * Math.cos(this.anchorAngle);
        var circleY = this.fromState.y + 1.5 * nodeRadius * Math.sin(this.anchorAngle);
        var circleRadius = 0.75 * nodeRadius;
        var startAngle = this.anchorAngle - Math.PI * 0.8;
        var endAngle = this.anchorAngle + Math.PI * 0.8;
        var startX = circleX + circleRadius * Math.cos(startAngle);
        var startY = circleY + circleRadius * Math.sin(startAngle);
        var endX = circleX + circleRadius * Math.cos(endAngle);
        var endY = circleY + circleRadius * Math.sin(endAngle);
        return {
            hasCircle: true,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            startAngle: startAngle,
            endAngle: endAngle,
            circleX: circleX,
            circleY: circleY,
            circleRadius: circleRadius
        };
    }

    draw(c) {
        var stuff = this.getEndPointsAndCircle();
        // draw arc
        c.beginPath();
        c.arc(
            stuff.circleX,
            stuff.circleY,
            stuff.circleRadius,
            stuff.startAngle,
            stuff.endAngle,
            false
        );
        c.stroke();
        // draw the withSymbol on the loop farthest from the fromState
        var textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
        var textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
        drawText(
            c,
            this.withSymbol,
            textX,
            textY,
            this.anchorAngle,
            selectedObject == this
        );
        // draw the head of the arrow
        drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);
    }

    containsPoint(x, y) {
        var stuff = this.getEndPointsAndCircle();
        var dx = x - stuff.circleX;
        var dy = y - stuff.circleY;
        var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
        return Math.abs(distance) < hitTargetPadding;
    }
}

class TemporaryLink {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }

    draw(c) {
        // draw the line
        c.beginPath();
        c.moveTo(this.to.x, this.to.y);
        c.lineTo(this.from.x, this.from.y);
        c.stroke();

        // draw the head of the arrow
        drawArrow(
            c,
            this.to.x,
            this.to.y,
            Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x)
        );
    }
}

// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
    this._points = [];
    this._texData = "";
    this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

    this.toLaTeX = function () {
        return (
            "\\documentclass[12pt]{article}\n" +
            "\\usepackage{tikz}\n" +
            "\n" +
            "\\begin{document}\n" +
            "\n" +
            "\\begin{center}\n" +
            "\\begin{tikzpicture}[scale=0.2]\n" +
            "\\tikzstyle{every fromState}+=[inner sep=0pt]\n" +
            this._texData +
            "\\end{tikzpicture}\n" +
            "\\end{center}\n" +
            "\n" +
            "\\end{document}\n"
        );
    };

    this.beginPath = function () {
        this._points = [];
    };
    this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
        x *= this._scale;
        y *= this._scale;
        radius *= this._scale;
        if (endAngle - startAngle == Math.PI * 2) {
            this._texData +=
                "\\draw [" +
                this.strokeStyle +
                "] (" +
                fixed(x, 3) +
                "," +
                fixed(-y, 3) +
                ") circle (" +
                fixed(radius, 3) +
                ");\n";
        } else {
            if (isReversed) {
                var temp = startAngle;
                startAngle = endAngle;
                endAngle = temp;
            }
            if (endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }
            // TikZ needs the angles to be in between -2pi and 2pi or it breaks
            if (Math.min(startAngle, endAngle) < -2 * Math.PI) {
                startAngle += 2 * Math.PI;
                endAngle += 2 * Math.PI;
            } else if (Math.max(startAngle, endAngle) > 2 * Math.PI) {
                startAngle -= 2 * Math.PI;
                endAngle -= 2 * Math.PI;
            }
            startAngle = -startAngle;
            endAngle = -endAngle;
            this._texData +=
                "\\draw [" +
                this.strokeStyle +
                "] (" +
                fixed(x + radius * Math.cos(startAngle), 3) +
                "," +
                fixed(-y + radius * Math.sin(startAngle), 3) +
                ") arc (" +
                fixed((startAngle * 180) / Math.PI, 5) +
                ":" +
                fixed((endAngle * 180) / Math.PI, 5) +
                ":" +
                fixed(radius, 3) +
                ");\n";
        }
    };
    this.moveTo = this.lineTo = function (x, y) {
        x *= this._scale;
        y *= this._scale;
        this._points.push({x: x, y: y});
    };
    this.stroke = function () {
        if (this._points.length == 0) return;
        this._texData += "\\draw [" + this.strokeStyle + "]";
        for (var i = 0; i < this._points.length; i++) {
            var p = this._points[i];
            this._texData +=
                (i > 0 ? " --" : "") +
                " (" +
                fixed(p.x, 2) +
                "," +
                fixed(-p.y, 2) +
                ")";
        }
        this._texData += ";\n";
    };
    this.fill = function () {
        if (this._points.length == 0) return;
        this._texData += "\\fill [" + this.strokeStyle + "]";
        for (var i = 0; i < this._points.length; i++) {
            var p = this._points[i];
            this._texData +=
                (i > 0 ? " --" : "") +
                " (" +
                fixed(p.x, 2) +
                "," +
                fixed(-p.y, 2) +
                ")";
        }
        this._texData += ";\n";
    };
    this.measureText = function (text) {
        var c = canvas.getContext("2d");
        c.font = `20px "${FONT}"`;
        return c.measureText(text);
    };
    this.advancedFillText = function (text, originalText, x, y, angleOrNull) {
        if (text.replace(" ", "").length > 0) {
            var nodeParams = "";
            // x and y start off as the center of the withSymbol, but will be moved to one side of the box when angleOrNull != null
            if (angleOrNull != null) {
                var width = this.measureText(text).width;
                var dx = Math.cos(angleOrNull);
                var dy = Math.sin(angleOrNull);
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (dx > 0) (nodeParams = "[right] "), (x -= width / 2);
                    else (nodeParams = "[left] "), (x += width / 2);
                } else {
                    if (dy > 0) (nodeParams = "[below] "), (y -= 10);
                    else (nodeParams = "[above] "), (y += 10);
                }
            }
            x *= this._scale;
            y *= this._scale;
            this._texData +=
                "\\draw (" +
                fixed(x, 2) +
                "," +
                fixed(-y, 2) +
                ") fromState " +
                nodeParams +
                "{$" +
                originalText.replace(/ /g, "\\mbox{ }") +
                "$};\n";
        }
    };

    this.translate = this.save = this.restore = this.clearRect = function () {
    };
}

// draw using this instead of a canvas and call toSVG() afterward
function ExportAsSVG() {
    this.fillStyle = "black";
    this.strokeStyle = "black";
    this.lineWidth = 1;
    this.font = `12px ${FONT}`;
    this._points = [];
    this._svgData = "";
    this._transX = 0;
    this._transY = 0;

    this.toSVG = function () {
        return (
            '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n<svg width="800" height="600" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' +
            this._svgData +
            "</svg>\n"
        );
    };

    this.beginPath = function () {
        this._points = [];
    };
    this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
        x += this._transX;
        y += this._transY;
        var style =
            'stroke="' +
            this.strokeStyle +
            '" stroke-width="' +
            this.lineWidth +
            '" fill="none"';

        if (endAngle - startAngle == Math.PI * 2) {
            this._svgData +=
                "\t<ellipse " +
                style +
                ' cx="' +
                fixed(x, 3) +
                '" cy="' +
                fixed(y, 3) +
                '" rx="' +
                fixed(radius, 3) +
                '" ry="' +
                fixed(radius, 3) +
                '"/>\n';
        } else {
            if (isReversed) {
                var temp = startAngle;
                startAngle = endAngle;
                endAngle = temp;
            }

            if (endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }

            var startX = x + radius * Math.cos(startAngle);
            var startY = y + radius * Math.sin(startAngle);
            var endX = x + radius * Math.cos(endAngle);
            var endY = y + radius * Math.sin(endAngle);
            var useGreaterThan180 = Math.abs(endAngle - startAngle) > Math.PI;
            var goInPositiveDirection = 1;

            this._svgData += "\t<path " + style + ' d="';
            this._svgData += "M " + fixed(startX, 3) + "," + fixed(startY, 3) + " "; // startPoint(startX, startY)
            this._svgData += "A " + fixed(radius, 3) + "," + fixed(radius, 3) + " "; // radii(radius, radius)
            this._svgData += "0 "; // value of 0 means perfect circle, others mean ellipse
            this._svgData += +useGreaterThan180 + " ";
            this._svgData += +goInPositiveDirection + " ";
            this._svgData += fixed(endX, 3) + "," + fixed(endY, 3); // endPoint(endX, endY)
            this._svgData += '"/>\n';
        }
    };
    this.moveTo = this.lineTo = function (x, y) {
        x += this._transX;
        y += this._transY;
        this._points.push({x: x, y: y});
    };
    this.stroke = function () {
        if (this._points.length == 0) return;
        this._svgData +=
            '\t<polygon stroke="' +
            this.strokeStyle +
            '" stroke-width="' +
            this.lineWidth +
            '" points="';
        for (var i = 0; i < this._points.length; i++) {
            this._svgData +=
                (i > 0 ? " " : "") +
                fixed(this._points[i].x, 3) +
                "," +
                fixed(this._points[i].y, 3);
        }
        this._svgData += '"/>\n';
    };
    this.fill = function () {
        if (this._points.length == 0) return;
        this._svgData +=
            '\t<polygon fill="' +
            this.fillStyle +
            '" stroke-width="' +
            this.lineWidth +
            '" points="';
        for (var i = 0; i < this._points.length; i++) {
            this._svgData +=
                (i > 0 ? " " : "") +
                fixed(this._points[i].x, 3) +
                "," +
                fixed(this._points[i].y, 3);
        }
        this._svgData += '"/>\n';
    };
    this.measureText = function (text) {
        var c = canvas.getContext("2d");
        c.font = `20px "${FONT}"`;
        return c.measureText(text);
    };
    this.fillText = function (text, x, y) {
        x += this._transX;
        y += this._transY;
        if (text.replace(" ", "").length > 0) {
            this._svgData +=
                '\t<withSymbol x="' +
                fixed(x, 3) +
                '" y="' +
                fixed(y, 3) +
                `" font-family="${FONT}" font-size="20">` +
                textToXML(text) +
                "</withSymbol>\n";
        }
    };
    this.translate = function (x, y) {
        this._transX = x;
        this._transY = y;
    };

    this.save = this.restore = this.clearRect = function () {
    };
}

function convertLambda(text){
    text = text.replace("\\e",String.fromCharCode(949));
    return text;
}

function convertLatexShortcuts(text) {

    // subscripts
    for (var i = 0; i < 10; i++) {
        text= text.replace(
            new RegExp("" + i, "g"),
            String.fromCharCode(8320 + i)
        );
    }

    return text;
}

function textToXML(text) {
    text = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    var result = "";
    for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        if (c >= 0x20 && c <= 0x7e) {
            result += text[i];
        } else {
            result += "&#" + c + ";";
        }
    }
    return result;
}

function drawArrow(c, x, y, angle) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
    c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
    c.fill();
}

function canvasHasFocus() {
    return (document.activeElement || document.body) == document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected) {
    let text = convertLatexShortcuts(originalText);
    c.font = `20px ${FONT}`;
    var width = c.measureText(text).width;

    // center the withSymbol
    x -= width / 2;

    // position the withSymbol intelligently if given an angle
    if (angleOrNull != null) {
        var cos = Math.cos(angleOrNull);
        var sin = Math.sin(angleOrNull);
        var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
        var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
        var slide =
            sin * Math.pow(Math.abs(sin), 40) * cornerPointX -
            cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
        x += cornerPointX - sin * slide;
        y += cornerPointY + cos * slide;
    }

    // draw withSymbol and caret (round the coordinates so the caret falls on a pixel)
    if ("advancedFillText" in c) {
        c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
    } else {
        x = Math.round(x);
        y = Math.round(y);
        c.fillText(text, x, y + 6);
        if (isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
            x += width;
            c.beginPath();
            c.moveTo(x, y - 10);
            c.lineTo(x, y + 10);
            c.stroke();
        }
    }
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
    clearInterval(caretTimer);
    caretTimer = setInterval("caretVisible = !caretVisible; draw()", 500);
    caretVisible = true;
}

var canvas;
var nodeRadius = 30;
var states = [];
var transitions = [];

var snapToPadding = 8; // pixels
var hitTargetPadding = 8 // pixels
var selectedObject = null; // either a Transition or a State
var currentLink = null; // a Transition
var movingObject = false;
var originalClick;

function hasStartState() {
    var res = false;
    for (var i = 0; i < states.length; i++) {
        if (states[i].isStartState) {
            res = true;
        }
    }
    return res;
}

function isValid() {

    if(!hasStartState()){
        return false;
    }


    return true;
}

function getStartState() {
    return states.find(s => s.isStartState == true);
}

function clearTransitionEvaluation() {
    return transitions.forEach(t => t.isEvaluating = false);
}

function clearStateEvaluation() {
    return states.forEach(s => {
        s.isEvaluating = false;
        s.isAccepted = false;
    });
}

async function delay(timeout = 1000) {
    var timeout = document.getElementById("speed").value;
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, timeout)
    })
}

function evaluateTransition(fromState, withSymbol) {
    var state;
    if (isValid()) {
        this.transitions.forEach(t => {
            if (t.fromState == fromState && t.withSymbol.split(',').map(s => s.trim()).includes(withSymbol)) {
                t.isEvaluating = true;
                state = t.toState;
            }
        });
    }

    return state;
}

function clearClasses(el){
    el.removeAttribute("class");
}

function makeEvaluatingString(string, index){

}

async function verify() {
    selectedObject = null;
    clearStateEvaluation();
    var string = document.getElementById('word-input').value;

    clearClasses(document.getElementById("result-span"));
    document.getElementById("result-span").innerHTML = string;



    var currentState = this.getStartState();

    if(isValid()) {
        currentState.isEvaluating = true;
        draw();
        await delay();

        for (var i = 0; i < string.length; i++) {

            var error = false;
            var currentSymbol = string.charAt(i);
            var newState = await evaluateTransition(currentState, currentSymbol);
            if (!newState) {
                document.getElementById("result-span").innerHTML = "Rejected - Bad transition";
                clearClasses(document.getElementById("result-span"));
                document.getElementById("result-span").classList.add("error");
                error = true;
                break;
            }
            currentState.isEvaluating = false;
            draw();
            await delay();

            newState.isEvaluating = true;
            currentState = newState;
            clearTransitionEvaluation();
            draw();
            await delay();

        }

        if (!error) {
            document.getElementById("result-span").innerHTML = string + "<br>" + (currentState.isAcceptState ? "Accepted" : "Rejected");
            clearClasses(document.getElementById("result-span"));
            document.getElementById("result-span").classList.add(currentState.isAcceptState ? "success" : "error");
        }

        currentState.isAccepted = currentState.isAcceptState;
        draw();
    }else{
        document.getElementById("result-span").innerHTML = "Invalid Automata";
        clearClasses(document.getElementById("result-span"));
        document.getElementById("result-span").classList.add("error");
    }
    return currentState.isAcceptState;
}

async function clearScreen(){
    clearStateEvaluation();
    clearTransitionEvaluation();
    document.getElementById("result-span").innerHTML = '';
    draw();
}

async function toggleDarkMode(){
    var c = document.getElementById("canvas");
    clearClasses(c);
    c.classList.add("canvas");

    if(strokeColor == black) {
        strokeColor = white;
        c.classList.add("canvas-dark");
    }else{
        strokeColor = black;
    }

    draw();
}

let black = "black";
let white = "white";
let blue = "#2E86C1";
let red = "#C0392B";
let green = "#2ECC71";
let strokeColor = black;

function drawUsing(c) {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(0.5, 0.5);

    for (var i = 0; i < states.length; i++) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = (states[i].isAccepted) ? green :(states[i].isEvaluating) ? red : states[i] == selectedObject ? blue : strokeColor;
        states[i].draw(c);
    }
    for (var i = 0; i < transitions.length; i++) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = (transitions[i].isEvaluating) ? red : transitions[i] == selectedObject ? blue : strokeColor;
        transitions[i].draw(c);
    }
    if (currentLink != null) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = strokeColor;
        currentLink.draw(c);
    }

    c.restore();
}

function draw() {
    drawUsing(canvas.getContext("2d"));
    saveBackup();
}

function selectObject(x, y) {
    for (var i = 0; i < states.length; i++) {
        if (states[i].containsPoint(x, y)) {
            return states[i];
        }
    }
    for (var i = 0; i < transitions.length; i++) {
        if (transitions[i].containsPoint(x, y)) {
            return transitions[i];
        }
    }
    return null;
}

function snapNode(node) {
    for (var i = 0; i < states.length; i++) {
        if (states[i] == node) continue;

        if (Math.abs(node.x - states[i].x) < snapToPadding) {
            node.x = states[i].x;
        }

        if (Math.abs(node.y - states[i].y) < snapToPadding) {
            node.y = states[i].y;
        }
    }
}

window.onload = function () {
    canvas = document.getElementById("canvas");
    restoreBackup();
    draw();

    canvas.onmousedown = function (e) {
        var mouse = crossBrowserRelativeMousePos(e);
        selectedObject = selectObject(mouse.x, mouse.y);
        movingObject = false;
        originalClick = mouse;

        if (selectedObject != null) {
            if (shift && selectedObject instanceof State) {
                currentLink = new SelfTransition(selectedObject, mouse);
            } else {
                movingObject = true;
                deltaMouseX = deltaMouseY = 0;
                if (selectedObject.setMouseStart) {
                    selectedObject.setMouseStart(mouse.x, mouse.y);
                }
            }
            resetCaret();
        } else if (shift) {
            currentLink = new TemporaryLink(mouse, mouse);
        }

        draw();

        if (canvasHasFocus()) {
            // disable drag-and-drop only if the canvas is already focused
            return false;
        } else {
            // otherwise, let the browser switch the focus away from wherever it was
            resetCaret();
            return true;
        }
    };

    canvas.ondblclick = function (e) {
        var mouse = crossBrowserRelativeMousePos(e);
        selectedObject = selectObject(mouse.x, mouse.y);

        if (selectedObject == null) {
            selectedObject = new State(mouse.x, mouse.y, `q${states.length}`);
            states.push(selectedObject);
            resetCaret();
            draw();
        } else if (selectedObject instanceof State) {
            if (selectedObject.isAcceptState && !selectedObject.isStartState) {
                selectedObject.isAcceptState = false;
                selectedObject.isStartState = false;
            } else if (selectedObject.isStartState) {
                if(selectedObject.isAcceptState){
                    selectedObject.isAcceptState = true;
                    selectedObject.isStartState = false;
                }else{
                    selectedObject.isAcceptState = true;
                    selectedObject.isStartState = true;
                }
            } else {
                if (hasStartState()) {
                    selectedObject.isAcceptState = true;
                    selectedObject.isStartState = false;
                } else {
                    selectedObject.isAcceptState = false;
                    selectedObject.isStartState = true;
                }
            }

            draw();
        }
    };

    canvas.onmousemove = function (e) {
        var mouse = crossBrowserRelativeMousePos(e);

        if (currentLink != null) {
            var targetNode = selectObject(mouse.x, mouse.y);
            if (!(targetNode instanceof State)) {
                targetNode = null;
            }

            if (selectedObject == null) {
                if (targetNode != null) {
                    //currentLink = new StartLink(targetNode, originalClick);
                } else {
                    currentLink = new TemporaryLink(originalClick, mouse);
                }
            } else {
                if (targetNode == selectedObject) {
                    currentLink = new SelfTransition(selectedObject, mouse);
                } else if (targetNode != null) {
                    currentLink = new Transition(selectedObject, targetNode);
                } else {
                    currentLink = new TemporaryLink(selectedObject.closestPointOnCircle(mouse.x, mouse.y), mouse);
                }
            }
            draw();
        }

        if (movingObject) {
            selectedObject.setAnchorPoint(mouse.x, mouse.y);
            if (selectedObject instanceof State) {
                snapNode(selectedObject);
            }
            draw();
        }
    };

    canvas.onmouseup = function (e) {
        movingObject = false;

        if (currentLink != null) {
            if (!(currentLink instanceof TemporaryLink)) {
                selectedObject = currentLink;
                transitions.push(currentLink);
                resetCaret();
            }
            currentLink = null;
            draw();
        }
    };
};

var shift = false;

document.onkeydown = function (e) {
    var key = crossBrowserKey(e);

    if (key == 16) {
        shift = true;
    } else if (!canvasHasFocus()) {
        // don't read keystrokes when other things have focus
        return true;
    } else if (key == 46 || (shift && key == 8)) {
        // delete key
        if (selectedObject != null) {
            for (var i = 0; i < states.length; i++) {
                if (states[i] == selectedObject) {
                    states.splice(i--, 1);
                }
            }
            for (var i = 0; i < transitions.length; i++) {
                if (
                    transitions[i] == selectedObject ||
                    transitions[i].fromState == selectedObject ||
                    transitions[i].fromState == selectedObject ||
                    transitions[i].toState == selectedObject
                ) {
                    transitions.splice(i--, 1);
                }
            }
            selectedObject = null;
            draw();
        }
    } else if (key == 8) {
        // backspace key
        if (selectedObject != null && "withSymbol" in selectedObject) {
            selectedObject.withSymbol = selectedObject.withSymbol.substr(
                0,
                selectedObject.withSymbol.length - 1
            );
            resetCaret();
            draw();
        }

        // backspace is a shortcut for the back button, but do NOT want to change pages
        return false;
    }
};

document.onkeyup = function (e) {
    var key = crossBrowserKey(e);

    if (key == 16) {
        shift = false;
    }
};

document.onkeypress = function (e) {
    // don't read keystrokes when other things have focus
    var key = crossBrowserKey(e);
    if (!canvasHasFocus()) {
        // don't read keystrokes when other things have focus
        return true;
    } else if (
        key >= 0x20 &&
        key <= 0x7e &&
        !e.metaKey &&
        !e.altKey &&
        !e.ctrlKey &&
        selectedObject != null &&
        "withSymbol" in selectedObject
    ) {
        selectedObject.withSymbol += String.fromCharCode(key);
        selectedObject.withSymbol = convertLambda(selectedObject.withSymbol);
        resetCaret();
        draw();

        // don't let keys do their actions (like space scrolls down the page)
        return false;
    } else if (key == 8) {
        // backspace is a shortcut for the back button, but do NOT want to change pages
        return false;
    }
};

function crossBrowserKey(e) {
    e = e || window.event;
    return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
    e = e || window.event;
    var obj = e.target || e.srcElement;
    var x = 0,
        y = 0;
    while (obj.offsetParent) {
        x += obj.offsetLeft;
        y += obj.offsetTop;
        obj = obj.offsetParent;
    }
    return {x: x, y: y};
}

function crossBrowserMousePos(e) {
    e = e || window.event;
    return {
        x:
        e.pageX ||
        e.clientX +
        document.body.scrollLeft +
        document.documentElement.scrollLeft,
        y:
        e.pageY ||
        e.clientY + document.body.scrollTop + document.documentElement.scrollTop
    };
}

function crossBrowserRelativeMousePos(e) {
    var element = crossBrowserElementPos(e);
    var mouse = crossBrowserMousePos(e);
    return {
        x: mouse.x - element.x,
        y: mouse.y - element.y
    };
}

function output(text) {
    var element = document.getElementById("output");
    element.style.display = "block";
    element.value = text;
}

function saveAsPNG() {
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(canvas.getContext("2d"));
    selectedObject = oldSelectedObject;
    var pngData = canvas.toDataURL("image/png");
    document.location.href = pngData;
}

function saveAsSVG() {
    var exporter = new ExportAsSVG();
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(exporter);
    selectedObject = oldSelectedObject;
    var svgData = exporter.toSVG();
    output(svgData);
    // Chrome isn't ready for this yet, the 'Save As' menu item is disabled
    // document.location.href = 'data:image/svg+xml;base64,' + btoa(svgData);
}

function saveAsLaTeX() {
    var exporter = new ExportAsLaTeX();
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(exporter);
    selectedObject = oldSelectedObject;
    var texData = exporter.toLaTeX();
    output(texData);
}

function det(a, b, c, d, e, f, g, h, i) {
    return a * e * i + b * f * g + c * d * h - a * f * h - b * d * i - c * e * g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
    var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
    var bx = -det(
        x1 * x1 + y1 * y1,
        y1,
        1,
        x2 * x2 + y2 * y2,
        y2,
        1,
        x3 * x3 + y3 * y3,
        y3,
        1
    );
    var by = det(
        x1 * x1 + y1 * y1,
        x1,
        1,
        x2 * x2 + y2 * y2,
        x2,
        1,
        x3 * x3 + y3 * y3,
        x3,
        1
    );
    var c = -det(
        x1 * x1 + y1 * y1,
        x1,
        y1,
        x2 * x2 + y2 * y2,
        x2,
        y2,
        x3 * x3 + y3 * y3,
        x3,
        y3
    );
    return {
        x: -bx / (2 * a),
        y: -by / (2 * a),
        radius: Math.sqrt(bx * bx + by * by - 4 * a * c) / (2 * Math.abs(a))
    };
}

function fixed(number, digits) {
    return number
        .toFixed(digits)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

function restoreBackup() {
    if (!localStorage || !JSON) {
        return;
    }

    try {
        var backup = JSON.parse(localStorage["fsm"]);

        for (var i = 0; i < backup.nodes.length; i++) {
            var backupNode = backup.nodes[i];
            var node = new State(backupNode.x, backupNode.y);
            node.isAcceptState = backupNode.isAcceptState;
            node.isStartState = backupNode.isStartState;
            node.withSymbol = backupNode.withSymbol;
            states.push(node);
        }
        for (var i = 0; i < backup.links.length; i++) {
            var backupLink = backup.links[i];
            var link = null;
            if (backupLink.type == "SelfTransition") {
                link = new SelfTransition(states[backupLink.fromState]);
                link.anchorAngle = backupLink.anchorAngle;
                link.withSymbol = backupLink.withSymbol;
            } else if (backupLink.type == "Transition") {
                link = new Transition(states[backupLink.fromState], states[backupLink.toState]);
                link.parallelPart = backupLink.parallelPart;
                link.perpendicularPart = backupLink.perpendicularPart;
                link.withSymbol = backupLink.withSymbol;
                link.lineAngleAdjust = backupLink.lineAngleAdjust;
            }
            if (link != null) {
                transitions.push(link);
            }
        }
    } catch (e) {
        localStorage["fsm"] = "";
    }
}

function saveBackup() {
    if (!localStorage || !JSON) {
        return;
    }

    var backup = {
        nodes: [],
        links: []
    };
    for (var i = 0; i < states.length; i++) {
        var node = states[i];
        var backupNode = {
            x: node.x,
            y: node.y,
            withSymbol: node.withSymbol,
            isAcceptState: node.isAcceptState,
            isStartState: node.isStartState
        };
        backup.nodes.push(backupNode);
    }
    for (var i = 0; i < transitions.length; i++) {
        var link = transitions[i];
        var backupLink = null;
        if (link instanceof SelfTransition) {
            backupLink = {
                type: "SelfTransition",
                fromState: states.indexOf(link.fromState),
                withSymbol: link.withSymbol,
                anchorAngle: link.anchorAngle
            };
        } else if (link instanceof Transition) {
            backupLink = {
                type: "Transition",
                fromState: states.indexOf(link.fromState),
                toState: states.indexOf(link.toState),
                withSymbol: link.withSymbol,
                lineAngleAdjust: link.lineAngleAdjust,
                parallelPart: link.parallelPart,
                perpendicularPart: link.perpendicularPart
            };
        }
        if (backupLink != null) {
            backup.links.push(backupLink);
        }
    }

    localStorage["fsm"] = JSON.stringify(backup);
}

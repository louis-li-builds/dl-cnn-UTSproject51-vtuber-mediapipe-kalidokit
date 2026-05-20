#!/usr/bin/env python3
"""Export Set A Exp02 (VGGStyleCNN) checkpoint to ONNX for vtuber-demo."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import torch.nn as nn


def conv_block(c_in: int, c_out: int, n: int) -> nn.Sequential:
    layers: list[nn.Module] = []
    for i in range(n):
        layers += [
            nn.Conv2d(c_in if i == 0 else c_out, c_out, 3, padding=1, bias=False),
            nn.BatchNorm2d(c_out),
            nn.ReLU(inplace=True),
        ]
    return nn.Sequential(*layers)


class VGGStyleCNN(nn.Module):
    def __init__(self, num_classes: int = 12):
        super().__init__()
        self.net = nn.Sequential(
            conv_block(3, 64, 2),
            nn.MaxPool2d(2),
            conv_block(64, 128, 2),
            nn.MaxPool2d(2),
            conv_block(128, 256, 3),
            nn.MaxPool2d(2),
            conv_block(256, 256, 3),
            nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.4),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.net(x))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--num-classes", type=int, default=12)
    args = parser.parse_args()

    device = torch.device("cpu")
    model = VGGStyleCNN(num_classes=args.num_classes)
    checkpoint = torch.load(args.weights, map_location=device, weights_only=False)
    state = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state, strict=False)
    model.eval()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.randn(1, 3, args.img_size, args.img_size)
    torch.onnx.export(
        model,
        dummy,
        str(args.output),
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    print(f"Exported ONNX → {args.output} ({args.output.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()

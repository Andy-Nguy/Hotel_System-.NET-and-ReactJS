import React from "react";
import { Text } from "react-native";
import {
  FontAwesome,
  MaterialIcons,
  Ionicons,
  Feather,
  FontAwesome5,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  library?:
    | "FontAwesome"
    | "FontAwesome5"
    | "MaterialIcons"
    | "MaterialCommunityIcons"
    | "Ionicons"
    | "Feather";
};

const AppIcon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = "#000",
  library = "FontAwesome",
  style,
}) => {
  switch (library) {
    case "MaterialIcons":
      return (
        <MaterialIcons
          name={name as any}
          size={size}
          color={color}
          style={style}
        />
      );
    case "MaterialCommunityIcons":
      return (
        <MaterialCommunityIcons
          name={name as any}
          size={size}
          color={color}
          style={style}
        />
      );
    case "Ionicons":
      return (
        <Ionicons name={name as any} size={size} color={color} style={style} />
      );
    case "Feather":
      return (
        <Feather name={name as any} size={size} color={color} style={style} />
      );
    case "FontAwesome5":
      return (
        <FontAwesome5
          name={name as any}
          size={size}
          color={color}
          style={style}
        />
      );
    case "FontAwesome":
    default:
      return (
        <FontAwesome
          name={name as any}
          size={size}
          color={color}
          style={style}
        />
      );
  }
};

export default AppIcon;
